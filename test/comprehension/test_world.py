def test_boundary_clamping(agent):
    answer = agent(
        "Are the players and the ball both held inside the playing area by "
        "the simulation on every step?",
        schema={
            "type": "object",
            "properties": {
                "held": {
                    "enum": [
                        "both are held inside",
                        "only the players are held inside",
                        "only the ball is held inside",
                        "neither is held inside",
                    ]
                },
            },
            "required": ["held"],
        },
    )
    assert answer["held"] == "only the players are held inside"
