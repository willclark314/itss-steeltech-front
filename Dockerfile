FROM node:22-alpine AS build

WORKDIR /app

COPY itss-steeltech-front/package.json itss-steeltech-front/package-lock.json ./
RUN npm ci

COPY itss-steeltech-front/ .
RUN npm run build

FROM nginx:1.27-alpine

COPY itss-steeltech-front/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
