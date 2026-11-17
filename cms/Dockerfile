# Directus with the Sagas theme, marketplace plugins and our own extension.

FROM node:22-alpine AS extensions

# Our hand-written extension (hook + display), built with the official SDK.
WORKDIR /build/sagas
COPY cms/extensions/sagas/package.json cms/extensions/sagas/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY cms/extensions/sagas/src ./src
RUN npm run build && mkdir -p /out/directus-extension-sagas \
    && cp -r package.json dist /out/directus-extension-sagas/

# Marketplace plugins: prebuilt npm packages unpacked as local extensions.
ARG PLUGINS="\
    @directus-labs/dark-terminal-theme@1.0.1 \
    @directus-labs/spreadsheet-layout@1.0.2 \
    @directus-labs/card-select-interfaces@1.0.0 \
    @directus-labs/command-palette-module@2.0.0"
WORKDIR /build/plugins
RUN for plugin in $PLUGINS; do \
        name=$(echo "${plugin%@*}" | tr -d '@' | tr '/' '-'); \
        npm pack --silent "$plugin" >/dev/null && mkdir -p "/out/$name" \
        && tar -xzf ./*.tgz -C "/out/$name" --strip-components=1 && rm ./*.tgz; \
    done

FROM directus/directus:12.6.1
COPY --from=extensions --chown=node:node /out/ /directus/extensions/
