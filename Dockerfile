FROM node:12-alpine
ADD . /mines
WORKDIR /mines
RUN npm install
CMD [ "npm", "start" ]
