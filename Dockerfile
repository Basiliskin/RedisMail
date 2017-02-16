# alpine:3.2
FROM easypi/alpine-arm

RUN apk add --update nodejs

RUN npm install websocket node-zip mysql request
RUN mkdir -p /opt/log && mkdir -p /opt/app


RUN npm install redis redis-eval

RUN npm install pm2 -g

RUN apk add --no-cache make gcc g++ python
	
RUN npm install express
RUN npm install connect-redis express-session


RUN npm install synchronize

RUN npm install moment


RUN apk update && apk add bash zip && rm -rf /var/cache/apk/*

RUN npm install connect-busboy


RUN mkdir /opt/app/mailer
COPY ./ /opt/app/mailer/


EXPOSE 8080 8090

CMD ["pm2-docker","/opt/app/mailer/ecosystem.config.js"]

