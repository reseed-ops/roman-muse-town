# The bridge on the town channel (Task 19, Nov 6, 2026). Railway builds
# this with the upload root as the context: bridge/ and shared/ side by
# side (the bridge's tsconfig compiles ../shared alongside src/), so the
# service's RAILWAY_DOCKERFILE_PATH is bridge/Dockerfile and its root
# directory stays "/". The tended pack (bridge/pack.md, never in git)
# rides in the upload. Secrets never enter this image: DIRECTOR_TOKEN,
# VISITOR_TOKEN and ANTHROPIC_API_KEY are the service's variables.
FROM node:22-alpine AS build
WORKDIR /app
# shared/ has no package.json of its own; in the repo the root one marks it
# as ES modules. Without this line tsc compiles it as CommonJS and fails
# (TS1287 under verbatimModuleSyntax), the first upload's build log.
RUN echo '{"type":"module"}' > package.json
COPY shared ./shared
COPY bridge/package.json ./bridge/package.json
RUN cd bridge && npm install
COPY bridge ./bridge
RUN cd bridge && npm run build

FROM node:22-alpine
WORKDIR /app/bridge
COPY --from=build /app/bridge/dist ./dist
COPY --from=build /app/bridge/node_modules ./node_modules
COPY --from=build /app/bridge/package.json ./package.json
COPY bridge/pack.md ./pack.md
ENV NODE_ENV=production
CMD ["npm", "start"]
