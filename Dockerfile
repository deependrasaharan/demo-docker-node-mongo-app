FROM node:20-alpine

# ENV mongoUrlLocal = "mongodb://admin:password@127.0.0.1:27017/?authSource=admin"  #no need, already in code, although bad practice hardcoding in code or even here in dockerfile

# RUN mkdir -p /home/app

WORKDIR /home/app

ENV NODE_ENV=production 
#this one is fine to keep in the Dockerfile. It's not a secret, it's a build/runtime behaviour flag that tells Node.js and npm to run in production mode (disables debug output, enables optimisations). This belongs in the image.

COPY app/package*.json ./
RUN npm ci --omit=dev

COPY app/images ./images

COPY app/index.html app/server.js ./

EXPOSE 3000
# technically optional, it doesn't actually open any port. It's just documentation — telling anyone reading the Dockerfile "this app listens on 3000". The actual port binding happens with -p at docker run time. But good practice to keep it.

CMD [ "npm","start"]