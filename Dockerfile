# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS frontend-builder
WORKDIR /app/front-end

COPY front-end/package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

COPY front-end/ ./
RUN npm run build

FROM debian:bookworm-slim AS backend-builder
ENV DEBIAN_FRONTEND=noninteractive

RUN --mount=type=cache,target=/var/cache/apt \
    apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    cmake \
    g++ \
    git \
    make \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/back-end
COPY back-end/ ./

RUN --mount=type=cache,target=/root/.cache/cmake \
    cmake -S . -B build -DCMAKE_BUILD_TYPE=Release -DFETCHCONTENT_BASE_DIR=/root/.cache/cmake && \
    cmake --build build -j"$(nproc)"

FROM nginx:1.27-bookworm AS runtime

COPY --from=frontend-builder /app/front-end/dist/ /usr/share/nginx/html/
COPY --from=backend-builder /app/back-end/build/server /usr/local/bin/server

RUN cat <<'EOF' >/etc/nginx/conf.d/default.conf
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location /simulate {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

RUN cat <<'EOF' >/usr/local/bin/start.sh
#!/bin/sh
set -eu

/usr/local/bin/server &
exec nginx -g 'daemon off;'
EOF

RUN chmod +x /usr/local/bin/start.sh

EXPOSE 80

CMD ["/usr/local/bin/start.sh"]