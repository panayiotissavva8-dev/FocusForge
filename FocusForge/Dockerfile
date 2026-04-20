# ── Stage 1: Build ──────────────────────────────────────────
FROM ubuntu:24.04 AS builder

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    build-essential cmake git curl zip unzip tar pkg-config \
    libssl-dev libsqlite3-dev libcurl4-openssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Install vcpkg
RUN git clone https://github.com/microsoft/vcpkg /vcpkg \
    && /vcpkg/bootstrap-vcpkg.sh -disableMetrics

ENV VCPKG_ROOT=/vcpkg

# Install only what vcpkg needs (NOT crow - handled separately)
RUN /vcpkg/vcpkg install cpr nlohmann-json asio

# Install Crow header-only directly from GitHub
RUN git clone --depth=1 https://github.com/CrowCpp/Crow /crow

WORKDIR /app
COPY . .

RUN cmake -S . -B build \
    -DCMAKE_TOOLCHAIN_FILE=/vcpkg/scripts/buildsystems/vcpkg.cmake \
    -DCMAKE_BUILD_TYPE=Release \
    -DCROW_INCLUDE_DIR=/crow/include \
    && cmake --build build --target focusforge -j$(nproc)

# ── Stage 2: Runtime ─────────────────────────────────────────
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    libssl3 libsqlite3-0 libcurl4 ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/build/focusforge .
COPY web/ ./web/
COPY lang/ ./lang/
RUN mkdir -p /app/data

EXPOSE 8080
CMD ["./focusforge"]