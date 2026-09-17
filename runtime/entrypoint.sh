#!/bin/sh
set -eu

profile_name="fork"
profile_home="${HERMES_HOME:-/opt/data}/profiles/${profile_name}"

for source in /fork-config/SOUL.md /fork-config/SKILL.md /fork-config/config.json \
    /opt/fork/secrets/buzz-private-key /opt/fork/secrets/model-key; do
    if [ ! -f "$source" ] || [ -L "$source" ]; then
        echo "[fork] missing required regular file: $source" >&2
        exit 1
    fi
done

export BUZZ_PRIVATE_KEY="$(cat /opt/fork/secrets/buzz-private-key)"
model_key="$(cat /opt/fork/secrets/model-key)"
export "${MODEL_KEY_ENV}=${model_key}"
unset model_key
touch /run/fork-secrets-ready

if [ ! -d "$profile_home" ]; then
    /opt/hermes/.venv/bin/hermes profile create "$profile_name" --no-alias --no-skills
fi

/opt/hermes/.venv/bin/python /opt/fork/merge_config.py \
    /opt/fork/config.base.json /fork-config/config.json "$profile_home/config.yaml"

install -m 0444 /fork-config/SOUL.md "$profile_home/SOUL.md"
install -d -m 0700 "$profile_home/skills/$profile_name"
install -m 0444 /fork-config/SKILL.md "$profile_home/skills/$profile_name/SKILL.md"

export HERMES_HOME="$profile_home"
exec /opt/hermes/docker/main-wrapper.sh "$@"
