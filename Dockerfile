FROM node:lts-slim AS runner
WORKDIR /node-express
ENV NODE_ENV production

ARG COMMIT_ID
ENV COMMIT_ID=${COMMIT_ID}
COPY . .
# FROM node:lts-slim



# COPY --from=build /home/node/app/dist /home/node/app/package.json /home/node/app/package-lock.json ./
RUN npm ci --production
USER node
EXPOSE 8080
CMD [ "node", "app.js" ]