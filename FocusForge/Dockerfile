FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# system deps
RUN apt-get update && apt-get install -y \
    git cmake g++ ninja-build \
    curl zip unzip tar pkg-config \
    libssl-dev libsqlite3-dev libcurl4-openssl-dev

# vcpkg
RUN git clone https://github.com/microsoft/vcpkg.git /vcpkg && \
    /vcpkg/bootstrap-vcpkg.sh

ENV VCPKG_ROOT=/vcpkg

WORKDIR /app
COPY . .

# IMPORTANT: one clean build only
RUN cmake -B build \
    -DCMAKE_TOOLCHAIN_FILE=/vcpkg/scripts/buildsystems/vcpkg.cmake \
    -DVCPKG_MANIFEST_MODE=ON \
    -DCMAKE_BUILD_TYPE=Release && \
    cmake --build build -j$(nproc)

ENV PORT=8080

CMD ["./build/focusforge"]