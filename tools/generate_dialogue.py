import json
import os
import random
import urllib.request

LINES_PER_EVENT = 8

EVENTS = ["run_start", "low_health", "level_up", "boss_incoming", "idle", "death"]

SLOTS = {
    "exclaim": [("Yikes", 3), ("Uh oh", 2), ("Careful", 2), ("Heads up", 1)],
    "hp_adjective": [("critical", 3), ("dangerously low", 2), ("not great", 2), ("concerning", 1)],
    "praise": [("Nice work", 3), ("Solid", 2), ("Not bad", 2), ("Impressive", 1)],
    "boss_name": [("something big", 3), ("a serious threat", 2), ("real trouble", 2)],
    "idle_filler": [("just saying", 2), ("no rush", 2), ("whenever you're ready", 1)],
}

TEMPLATES = {
    "run_start": [
        "Systems online. Let's move.",
        "Danger Dial locked in. Here we go.",
        "Ready when you are.",
        "Diagnostics green across the board. Go time.",
    ],
    "low_health": [
        "{exclaim}, your HP is {hp_adjective}.",
        "{exclaim}! We might want a healer module for this.",
        "That HP bar looks {hp_adjective}. Consider disengaging.",
        "{exclaim} - patch yourself up if you can.",
    ],
    "level_up": [
        "{praise}. Systems upgrading.",
        "Level up! {praise}, really.",
        "{praise} - I felt that power spike from here.",
        "New level. {praise}.",
    ],
    "boss_incoming": [
        "Sensors picking up {boss_name} nearby.",
        "Whatever that is, it's big. Stay sharp.",
        "This next one won't go down easy.",
        "Reading {boss_name} dead ahead.",
    ],
    "idle": [
        "Still here. {idle_filler}.",
        "Quiet out here. Too quiet.",
        "I'll just be over here, {idle_filler}.",
        "Standing by.",
    ],
    "death": [
        "...that's a wrap. Back to the Hub.",
        "We'll get 'em next time.",
        "Rebooting. See you on the next run.",
        "Not the ending I had planned either.",
    ],
}

def pick(slot_name):
    options = SLOTS[slot_name]
    return random.choices([w for w, _ in options], weights=[wt for _, wt in options])[0]

def generate_lines_for_event(event_name):
    templates = TEMPLATES[event_name]
    lines = set()
    attempts = 0
    max_attempts = LINES_PER_EVENT * 25
    while len(lines) < LINES_PER_EVENT and attempts < max_attempts:
        template = random.choice(templates)
        line = template.format(
            exclaim=pick("exclaim"),
            hp_adjective=pick("hp_adjective"),
            praise=pick("praise"),
            boss_name=pick("boss_name"),
            idle_filler=pick("idle_filler"),
        )
        lines.add(line)
        attempts += 1
    return sorted(lines)

def generate_default_bank():
    return [{"event": event, "lines": generate_lines_for_event(event)} for event in EVENTS]

def generate_llm_bank(api_key):
    prompt = (
        "Write dialogue for a small AI companion drone in a 3D roguelite "
        "game, in this exact JSON shape: "
        '[{"event": "run_start", "lines": ["...", ...]}, ...] '
        f"with events {EVENTS} and {LINES_PER_EVENT} short lines per event. "
        "Dry, a little sarcastic, never more than one sentence per line. "
        "Return ONLY the JSON array, no other text."
    )
    body = json.dumps({
        "model": "claude-sonnet-4-6",
        "max_tokens": 2000,
        "messages": [{"role": "user", "content": prompt}],
    }).encode("utf-8")

    request = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=body,
        headers={
            "Content-Type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            result = json.loads(response.read())
        text = result["content"][0]["text"].strip()
        return json.loads(text)
    except Exception as error:
        print(f"LLM generation failed ({error}), falling back to the default generator.")
        return None

def main():
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    bank = generate_llm_bank(api_key) if api_key else None
    if bank is None:
        bank = generate_default_bank()

    output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "assets", "dialogue.json")
    output_path = os.path.normpath(output_path)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(bank, f, indent=2)
    total_lines = sum(len(entry["lines"]) for entry in bank)
    print(f"Wrote {total_lines} lines across {len(bank)} events to {output_path}")

if __name__ == "__main__":
    main()