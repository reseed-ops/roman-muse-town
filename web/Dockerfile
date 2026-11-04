# The town on the web (Task 8). Railway builds this with the repository
# root as the context (leave the service's root directory at "/", and
# point its config path at /web/railway.toml): the client, the server
# and shared/ all live outside web/, so a web/-rooted service would see
# none of them. Secrets never enter this image: DATABASE_URL,
# DIRECTOR_TOKEN and TOWN_SECRET are the service's variables.
FROM oven/bun:1.3 AS build
WORKDIR /app
COPY web/package.json web/package.json
RUN cd web && bun install
COPY . .
# The root package.json names the hosted SDK, which is not on this
# machine; the web's own dependencies stand in for it.
RUN ln -sfn web/node_modules node_modules && bun run web/build.ts

FROM oven/bun:1.3
WORKDIR /app
COPY --from=build /app/web/dist web/dist
ENV PORT=8080
EXPOSE 8080
CMD ["bun", "run", "web/dist/server.js"]
