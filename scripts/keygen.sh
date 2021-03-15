#!/bin/sh

openssl req -new -text -passout pass:abcd -subj /CN=localhost -out ca/server.req -keyout ca/privkey.pem
openssl rsa -in ca/privkey.pem -passin pass:abcd -out ca/server.key
openssl req -x509 -in ca/server.req -text -key ca/server.key -out ca/server.crt

chmod 600 ca/server.key
