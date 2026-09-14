FROM node:22-bookworm AS build

ENV PATH="/root/.cargo/bin:${PATH}"

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    file \
    libssl-dev \
    libwebkit2gtk-4.1-dev \
    librsvg2-dev \
    patchelf \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
    | sh -s -- -y --profile minimal --no-modify-path

RUN npm install --global pnpm@10.32.1

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY index.html vite.config.js jsconfig.json components.json ./
COPY src ./src
COPY src-tauri ./src-tauri

RUN cargo test --manifest-path src-tauri/Cargo.toml
RUN pnpm tauri build --bundles deb

FROM scratch AS artifact
COPY --from=build /app/src-tauri/target/release/bundle/deb/ /
