# Dockerfile for building node-sqlite3 on Ubuntu 20.04
# This is required to target older GLIBC versions since GitHub Actions no longer provides Ubuntu 20.04 runners
ARG NODE_VERSION=18

# Use Ubuntu 20.04 as the base for older GLIBC compatibility
FROM ubuntu:20.04

ARG NODE_VERSION
ARG DEBIAN_FRONTEND=noninteractive

# Install build dependencies and Node.js
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    python3-pip \
    git \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js using NodeSource repository
RUN curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install yarn globally
RUN npm install -g yarn

# Verify installations
RUN node --version && npm --version && yarn --version && python3 --version

WORKDIR /usr/src/build

# Copy project files
COPY . .

# Install dependencies
RUN npm install --ignore-scripts

# Set compiler flags for GCC compatibility
ENV CFLAGS="-include ../src/gcc-preinclude.h"
ENV CXXFLAGS="-include ../src/gcc-preinclude.h"

# Build the native module
RUN npm run prebuild

# Print binary info for verification
RUN ldd build/**/node_sqlite3.node && \
  echo "---" && \
  nm build/**/node_sqlite3.node | grep "GLIBC_" | c++filt || true && \
  echo "---" && \
  file build/**/node_sqlite3.node

# Run tests to ensure the build works
RUN npm run test

CMD ["bash"]
