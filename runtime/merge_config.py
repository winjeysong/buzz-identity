"""Merge the client-provided model overlay into the image's security baseline.

Only the "model" key is accepted from the overlay; every other security-relevant
setting is controlled by the image so a client cannot widen the tool or plugin
surface by editing its own config file.
"""

import json
import sys


def main() -> int:
    if len(sys.argv) != 4:
        print("usage: merge_config.py <base.json> <overlay.json> <output>", file=sys.stderr)
        return 2
    base_path, overlay_path, output_path = sys.argv[1:4]

    with open(base_path, encoding="utf-8") as handle:
        config = json.load(handle)

    with open(overlay_path, encoding="utf-8") as handle:
        overlay = json.load(handle)

    if not isinstance(overlay, dict):
        print("overlay must be a JSON object", file=sys.stderr)
        return 1

    unknown = set(overlay) - {"model"}
    if unknown:
        print(f"overlay may only contain 'model', got: {sorted(unknown)}", file=sys.stderr)
        return 1

    model = overlay.get("model", {})
    if not isinstance(model, dict):
        print("overlay.model must be a JSON object", file=sys.stderr)
        return 1
    allowed_model_keys = {"provider", "default", "base_url"}
    unknown_model = set(model) - allowed_model_keys
    if unknown_model:
        print(f"overlay.model may only contain {sorted(allowed_model_keys)}", file=sys.stderr)
        return 1
    for key, value in model.items():
        if not isinstance(value, str) or not value:
            print(f"overlay.model.{key} must be a non-empty string", file=sys.stderr)
            return 1

    config["model"].update(model)

    with open(output_path, "w", encoding="utf-8") as handle:
        json.dump(config, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
