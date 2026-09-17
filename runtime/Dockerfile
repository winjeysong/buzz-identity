FROM rust:1.95.0-bookworm@sha256:6258907abe69656e41cd992e0b705cdcfabcbbe3db374f92ed2d47121282d4a1 AS buzz-builder

ADD --checksum=sha256:ad8954e1ea138acc39ab781f4d83ea048ba8d5cf31e3060f361a691ce819c2c5 https://codeload.github.com/block/buzz/tar.gz/9ceb1f79bbc21785a0a075c40aecb3c058b1ea15 /tmp/buzz.tar.gz
RUN mkdir -p /src/buzz \
    && tar -xzf /tmp/buzz.tar.gz -C /src/buzz --strip-components=1 \
    && cd /src/buzz \
    && cargo build --release --locked -p buzz-cli

FROM nousresearch/hermes-agent:v2026.9.11

RUN install -d -o root -g root -m 0555 /opt/fork /opt/fork/secrets
COPY --from=buzz-builder --chown=root:root --chmod=0555 /src/buzz/target/release/buzz /usr/local/bin/buzz
COPY --chown=root:root --chmod=0555 plugins/fork_knowledge /opt/hermes/plugins/fork_knowledge
COPY --chown=root:root --chmod=0444 config.base.json /opt/fork/config.base.json
COPY --chown=root:root --chmod=0444 merge_config.py /opt/fork/merge_config.py
COPY --chown=root:root --chmod=0555 entrypoint.sh /opt/fork/entrypoint.sh
