#!/usr/bin/env python3
"""Comprehension test runner.

Each test asks an agent a question about the codebase. The agent reads a
snapshot of the working directory. It cannot read this directory.

Run from the project root. This file can sit in any directory; it finds the
tests and the config beside itself.

    python test/comprehension/runner.py
    python test/comprehension/runner.py --jobs 4
    python test/comprehension/runner.py test_new_provider

Config comes from config.py beside this file:

    EXCLUDE       list of glob patterns to keep out of the snapshot
    AGENT_COMMAND argv list, with "{prompt}" in one element
    TIMEOUT       seconds for one agent call

The definitions below run top down: a caller comes before the things it calls.
"""

from __future__ import annotations

import argparse
import fnmatch
import importlib.util
import json
import linecache
import os
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import traceback
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from pathlib import Path

RUNNER_VERSION = "1"
TESTS_DIR = Path(__file__).resolve().parent

PRINT_LOCK = threading.Lock()

SCHEMA_INSTRUCTION = (
    "Answer only with one JSON object. Do not add prose, an explanation, "
    "or code fences. The object must match this JSON schema:\n"
)

REASONING_KEY = "reasoning"
REASONING_FIELD = {
    "type": "string",
    "description": (
        "Fill this in last, after the answer above. One or two sentences: "
        "which locations you read, and what in them gave that answer."
    ),
}


class SetupError(Exception):
    """The runner or the config is wrong."""


class AgentError(Exception):
    """The agent call failed, or its reply is not usable."""


# --------------------------------------------------------------------------
# Entry point
# --------------------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser(description="Run comprehension tests.")
    parser.add_argument("tests", nargs="*", help="test or module names to run")
    parser.add_argument("--jobs", "-j", type=int, default=1, help="parallel tests")
    parser.add_argument(
        "--keep-snapshot", action="store_true", help="do not delete the temp copy"
    )
    args = parser.parse_args()

    root = Path.cwd().resolve()
    try:
        config = load_config()
        tests = select(discover(), args.tests)
        snapshot = make_snapshot(root, config)
    except SetupError as error:
        print(f"SETUP ERROR: {error}", file=sys.stderr)
        return 2

    print(f"snapshot: {snapshot}")
    print(f"tests: {len(tests)}  jobs: {args.jobs}\n")

    results: list[Result] = []
    try:
        if args.jobs > 1:
            with ThreadPoolExecutor(max_workers=args.jobs) as pool:
                futures = [pool.submit(run_test, t, config, snapshot) for t in tests]
                # as_completed, not the submission order. A short test must not
                # wait behind a long one to reach the terminal.
                for future in as_completed(futures):
                    result = future.result()
                    results.append(result)
                    report(result)
        else:
            for test in tests:
                result = run_test(test, config, snapshot)
                results.append(result)
                report(result)
    finally:
        if args.keep_snapshot:
            print(f"snapshot kept: {snapshot}")
        else:
            shutil.rmtree(snapshot, ignore_errors=True)

    counts = {"pass": 0, "fail": 0, "error": 0}
    for result in results:
        counts[result.status] += 1
    print(f"\n{counts['pass']} pass, {counts['fail']} fail, {counts['error']} error")
    return 0 if counts["fail"] == 0 and counts["error"] == 0 else 1


# --------------------------------------------------------------------------
# Config
# --------------------------------------------------------------------------


def load_config() -> Config:
    path = TESTS_DIR / "config.py"
    if not path.exists():
        raise SetupError(
            f"No config.py in {TESTS_DIR}. Ask the comprehension-tests skill "
            "to create it."
        )
    spec = importlib.util.spec_from_file_location("comprehension_config", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    command = list(getattr(module, "AGENT_COMMAND", []))
    if not command:
        raise SetupError("config.py has no AGENT_COMMAND.")
    if not any("{prompt}" in part for part in command):
        raise SetupError('AGENT_COMMAND has no "{prompt}" placeholder.')

    return Config(
        exclude=list(getattr(module, "EXCLUDE", [])),
        agent_command=command,
        timeout=int(getattr(module, "TIMEOUT", 300)),
    )


@dataclass
class Config:
    exclude: list[str] = field(default_factory=list)
    agent_command: list[str] = field(default_factory=list)
    timeout: int = 300


# --------------------------------------------------------------------------
# Discovery
# --------------------------------------------------------------------------


def discover() -> list[Test]:
    tests: list[Test] = []
    for path in sorted(TESTS_DIR.glob("test_*.py")):
        spec = importlib.util.spec_from_file_location(
            f"comprehension_{path.stem}", path
        )
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        for name in sorted(vars(module)):
            if not name.startswith("test_"):
                continue
            function = getattr(module, name)
            if callable(function):
                tests.append(Test(f"{path.stem}.{name}", function))
    return tests


@dataclass
class Test:
    name: str
    function: object


def select(tests: list[Test], wanted: list[str]) -> list[Test]:
    if not wanted:
        return tests
    chosen = []
    for test in tests:
        module, short = test.name.split(".", 1)
        if any(w in (test.name, short, module) for w in wanted):
            chosen.append(test)
    if not chosen:
        raise SetupError(f"No test matches {wanted}.")
    return chosen


# --------------------------------------------------------------------------
# Snapshot
# --------------------------------------------------------------------------


def make_snapshot(root: Path, config: Config) -> Path:
    """Copy the working directory to a temp directory, less the exclusions."""
    patterns = list(config.exclude)
    own = self_exclude_pattern(root)
    if own:
        patterns.append(own)

    dest = Path(tempfile.mkdtemp(prefix="comprehension-"))
    copied = 0

    for dirpath, dirnames, filenames in os.walk(root, followlinks=False):
        rel_dir = Path(dirpath).relative_to(root).as_posix()
        rel_dir = "" if rel_dir == "." else rel_dir

        kept = []
        for name in dirnames:
            rel = f"{rel_dir}/{name}" if rel_dir else name
            if matches(rel, patterns):
                continue
            if os.path.islink(os.path.join(dirpath, name)):
                continue
            kept.append(name)
        dirnames[:] = kept

        target_dir = dest / rel_dir if rel_dir else dest
        target_dir.mkdir(parents=True, exist_ok=True)

        for name in filenames:
            rel = f"{rel_dir}/{name}" if rel_dir else name
            source = Path(dirpath) / name
            if source.is_symlink() or matches(rel, patterns):
                continue
            try:
                shutil.copy2(source, target_dir / name)
                copied += 1
            except OSError:
                pass

    if copied == 0:
        raise SetupError("The snapshot is empty. Check EXCLUDE in config.py.")

    # An excluded directory can leave an empty parent. Remove it, so that the
    # agent does not read a signal into the shape of the tree.
    for dirpath, _, _ in sorted(os.walk(dest), reverse=True):
        if Path(dirpath) == dest:
            continue
        try:
            os.rmdir(dirpath)
        except OSError:
            pass
    return dest


def self_exclude_pattern(root: Path) -> str | None:
    """Keep this directory out of the snapshot. The tests hold the answers."""
    try:
        rel = TESTS_DIR.relative_to(root)
    except ValueError:
        return None
    return rel.as_posix()


def matches(rel: str, patterns: list[str]) -> bool:
    """Match the path, or any of its parents, against the patterns.

    A "*" crosses directory separators here. This makes "src/**" and
    "**/build" behave as expected.
    """
    parts = rel.split("/")
    candidates = ["/".join(parts[: i + 1]) for i in range(len(parts))]
    for pattern in patterns:
        pattern = pattern.rstrip("/")
        for candidate in candidates:
            if fnmatch.fnmatch(candidate, pattern):
                return True
    return False


# --------------------------------------------------------------------------
# One test
# --------------------------------------------------------------------------


def run_test(test: Test, config: Config, snapshot: Path) -> Result:
    agent, last = make_agent(config, snapshot)
    start = time.monotonic()
    try:
        test.function(agent)
    except AssertionError as error:
        message = str(error) or "AssertionError"
        return Result(
            test.name,
            "fail",
            time.monotonic() - start,
            last["prompt"],
            last["raw"],
            f"{assertion_source(error)}\n  {message}".strip(),
        )
    except (AgentError, SetupError) as error:
        return Result(
            test.name,
            "error",
            time.monotonic() - start,
            last["prompt"],
            last["raw"],
            str(error),
        )
    except Exception:
        return Result(
            test.name,
            "error",
            time.monotonic() - start,
            last["prompt"],
            last["raw"],
            traceback.format_exc().strip(),
        )
    return Result(test.name, "pass", time.monotonic() - start)


@dataclass
class Result:
    name: str
    status: str  # pass | fail | error
    seconds: float
    prompt: str | None = None
    raw: str | None = None
    detail: str = ""


def make_agent(config: Config, snapshot: Path):
    """Build the callable that a test receives.

    Returns the callable and a record of its last call. The record gives the
    report the prompt and the raw reply after a failure.
    """
    last: dict[str, str | None] = {"prompt": None, "raw": None}

    def agent(prompt: str, schema: dict):
        asked = with_reasoning(schema)
        full = (
            f"{prompt.strip()}\n\n"
            f"{SCHEMA_INSTRUCTION}{json.dumps(asked, indent=2)}"
        )
        last["prompt"] = full
        last["raw"] = None

        command = [part.replace("{prompt}", full) for part in config.agent_command]
        try:
            done = subprocess.run(
                command,
                cwd=snapshot,
                capture_output=True,
                text=True,
                timeout=config.timeout,
            )
        except FileNotFoundError as error:
            raise SetupError(f"Cannot start the agent: {error}") from None
        except subprocess.TimeoutExpired:
            raise AgentError(f"No reply in {config.timeout}s") from None

        last["raw"] = done.stdout
        if done.returncode != 0:
            tail = (done.stderr or "").strip()[-2000:]
            raise AgentError(f"The agent exited with {done.returncode}\n{tail}")

        text = done.stdout.strip()
        if not text:
            raise AgentError("The agent wrote nothing to stdout.")
        try:
            answer = json.loads(text)
        except json.JSONDecodeError as error:
            raise AgentError(
                f"stdout is not JSON ({error}). Set AGENT_COMMAND to a mode "
                "that prints only the reply."
            ) from None

        validate(answer, asked)
        if isinstance(answer, dict):
            answer.pop(REASONING_KEY, None)
        return answer

    return agent, last


def with_reasoning(schema: dict) -> dict:
    """Add a free-text field for the agent's own account of its answer.

    It goes last, so that the answer is written before the account of it. The
    report prints it with the failing reply. It is stripped from the value the
    test receives, and it is never required: a missing one is not an error.
    """
    properties = schema.get("properties")
    if schema.get("type") != "object" or not properties:
        return schema
    if REASONING_KEY in properties:
        raise SetupError(
            f"The schema defines {REASONING_KEY!r}. The runner adds that "
            "field itself, and strips it before the test sees it. Rename "
            "the field, or remove it."
        )
    return {**schema, "properties": {**properties, REASONING_KEY: REASONING_FIELD}}


def validate(value, schema, path: str = "answer") -> None:
    """Check a value against a small subset of JSON Schema.

    Supported: type, properties, required, additionalProperties, enum,
    items, minItems, maxItems.
    """
    if "enum" in schema and value not in schema["enum"]:
        raise AgentError(f"{path}: {value!r} is not one of {schema['enum']}")

    expected = schema.get("type")
    types = {
        "object": dict,
        "array": list,
        "string": str,
        "integer": int,
        "number": (int, float),
        "boolean": bool,
        "null": type(None),
    }
    if expected:
        wanted = types.get(expected)
        if wanted is None:
            raise SetupError(f"{path}: unknown schema type {expected!r}")
        if expected in ("integer", "number") and isinstance(value, bool):
            raise AgentError(f"{path}: expected {expected}, got a boolean")
        if not isinstance(value, wanted):
            raise AgentError(
                f"{path}: expected {expected}, got {type(value).__name__}"
            )

    if isinstance(value, dict):
        for key in schema.get("required", []):
            if key not in value:
                raise AgentError(f"{path}: the key {key!r} is missing")
        properties = schema.get("properties", {})
        if schema.get("additionalProperties") is False:
            extra = set(value) - set(properties)
            if extra:
                raise AgentError(f"{path}: unexpected keys {sorted(extra)}")
        for key, sub in properties.items():
            if key in value:
                validate(value[key], sub, f"{path}.{key}")

    if isinstance(value, list):
        if "minItems" in schema and len(value) < schema["minItems"]:
            raise AgentError(
                f"{path}: {len(value)} items, minimum is {schema['minItems']}"
            )
        if "maxItems" in schema and len(value) > schema["maxItems"]:
            raise AgentError(
                f"{path}: {len(value)} items, maximum is {schema['maxItems']}"
            )
        item_schema = schema.get("items")
        if item_schema:
            for index, item in enumerate(value):
                validate(item, item_schema, f"{path}[{index}]")


def assertion_source(error: BaseException) -> str:
    """Find the line in the test file that raised."""
    tb = error.__traceback__
    found = None
    while tb:
        filename = tb.tb_frame.f_code.co_filename
        try:
            if Path(filename).resolve().parent == TESTS_DIR:
                found = (filename, tb.tb_lineno)
        except OSError:
            pass
        tb = tb.tb_next
    if not found:
        return ""
    filename, lineno = found
    line = linecache.getline(filename, lineno).strip()
    return f"{Path(filename).name}:{lineno}\n    {line}"


# --------------------------------------------------------------------------
# Output
# --------------------------------------------------------------------------


def report(result: Result) -> None:
    with PRINT_LOCK:
        if result.status == "pass":
            print(f"PASS  {result.name} ({result.seconds:.1f}s)")
        else:
            label = "FAIL" if result.status == "fail" else "ERROR"
            print(f"\n{label}  {result.name} ({result.seconds:.1f}s)")
            if result.prompt:
                print("\n  prompt:")
                print(indent(result.prompt))
            if result.raw is not None:
                print("\n  reply:")
                print(indent(result.raw.strip() or "<empty>"))
            if result.detail:
                heading = "assertion:" if result.status == "fail" else "reason:"
                print(f"\n  {heading}")
                print(indent(result.detail))
            print()
        sys.stdout.flush()


def indent(text: str, prefix: str = "    ") -> str:
    return "\n".join(prefix + line for line in (text or "").splitlines())


if __name__ == "__main__":
    sys.exit(main())
