def test_import_direction(agent):
    answer = agent(
        "Leaving out the page entry file and the standalone demo pages, "
        "which way may imports run between the drawing modules and the "
        "rules-of-play modules?",
        schema={
            "type": "object",
            "properties": {
                "direction": {
                    "enum": [
                        "drawing may import rules",
                        "rules may import drawing",
                        "both directions",
                        "neither direction",
                    ]
                },
            },
            "required": ["direction"],
        },
    )
    assert answer["direction"] == "drawing may import rules"


def test_tick_owner(agent):
    answer = agent(
        "One module moves the whole game world on by exactly one fixed "
        "simulation step, calling the ball, player, decision and keyboard "
        "rules in a fixed order. Give its path from the repository root.",
        schema={
            "type": "object",
            "properties": {"path": {"type": "string"}},
            "required": ["path"],
        },
    )
    assert answer["path"] == "web/match.js"
