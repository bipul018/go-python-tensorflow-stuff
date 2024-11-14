Uses go,python, html, js to run a tensorflow/keras model on the provided stream (camera or video)

If you have a system with nix installed, you can just run commands through ./run shell file

or just go into nix-shell first and run the commands

If not nix user then you need to first install the dependencies, which can be read from shell.nix,
+ go programming language
+ python programming language (version 3.11 was used here)
+ tensorflow for python
+ numpy for python
+ keras for python
+ gcc (or any other c compiler on path)


To run the server, you can run command `go run .` The arguments taken in are serving address at `web_addr` and serving port at `web_port` which are by default set to localhost:8080. The go program will itself launch python program as necessary

