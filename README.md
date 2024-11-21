Uses go,python, html, js to run a tensorflow/keras or pytorch model on the provided stream (camera or video)

Currently, a pytorch model is selected to run.

Installation requirements:
 + Go
 + Python (3.11 was used)
 + Various python packages as specified in requirements.txt

If using nix-based system, you can use `setup-python-venv-first-time.sh` to install required items and setup the virtual environment through nix-shell.

Usage:
+ To run the server, you can run command `go run .` The arguments taken in are serving address at `web_addr` and serving port at `web_port` which are by default set to localhost:8080. 
+ The go program will itself launch python program as necessary
+ On launch, by default at localhost:8080, the websocket will be connected to the backend.
+ You have to enable at least one source of video first to use.
+ Either `Switch to camera` for webcam or Browse for video file will work.
+ The left side is the currently used webcam/video file and the right side is the canvas which draws the results from the backend.
+ There are two modes to use, streaming mode and accumulation mode.
+ For streaming mode, `Capture` will just take a snapshot and send to the backend, `Begin Streaming` and `End Streaming` will start and stop the streaming decided by the FPS mentioned at Stream FPS.
+ For accumulation mode, `Begin Collecting` and `End Collecting` will start and stop the frames collection first, also at Stream FPS. Then when using `Submit`, it sends the sampled frames only, as decided by the slider `Frames to Accumulate` to the backend.
+ For both modes, starting to stream/accumulate will automatically start video playback.
+ Also on video pause, for either modes, strea/accumulate will also pause.



