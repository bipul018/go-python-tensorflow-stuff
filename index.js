var scheduler_obj = null;
var scheduler_fps = 10;
document.getElementById('sliderValue').textContent = ''+scheduler_fps;

// Get the canvas and its context
var canvas = document.getElementById('paintCanvas');
var ctx = canvas.getContext('2d');

var video = document.getElementById('webcam');
const vid_dims = {width: 500, height:null};

const frame_collection = {
    frames: [],
    collecting: false
};
var slider_frame_count = 0
function update_frame_slider(){
    var val = document.getElementById('num_frames_slider').value;
    document.getElementById('num_frames').textContent = ''+val;
    slider_frame_count = val;
}
update_frame_slider();

document.getElementById('num_frames_slider').
    addEventListener('input', (evt) => update_frame_slider());





window.addEventListener("load", function(evt) {

    var output = document.getElementById("output");
    var input = document.getElementById("input");
    var ws;

    
    var print = function(message) {
        var d = document.createElement("div");
        d.textContent = message;
        output.appendChild(d);
        output.scroll(0, output.scrollHeight);
    };


    
    document.getElementById("open").onclick = function(evt) {
        if (ws) {
	    return false;
        }
        ws = new WebSocket("{{.}}");
        ws.onopen = function(evt) {
	    print("OPEN");
        }
        ws.onclose = function(evt) {
	    print("CLOSE");
	    ws = null;
        }
        ws.onmessage = async function(evt) {

	    if(typeof(evt.data) == "string"){
		print("RESPONSE: " + evt.data);
		document.getElementById('prediction_result').textContent = evt.data;
	    }
	    else{
		const str = "RESPONSE: <" + evt.data.type + ", " + evt.data.size + "> : " ;


		const arr = await evt.data.bytes();
		
		// Try to parse as image, then publish to canvas
		if(arr.length >= 3*8){
		    const args = new BigUint64Array(arr.slice(0,3*8).buffer);
		    const prob_img = new Uint8ClampedArray(arr.slice(3*8).buffer);
		    
		    print(str + "`" + args + "`" +
			  ((prob_img.length < Number(args[2]))?"Length not enough":""));

		    if(prob_img.length >= Number(args[2])){
			def_img = prob_img.slice(0,Number(args[2]));
			var imgdata = ctx.getImageData(0, 0, canvas.width, canvas.height);
			imgdata.data.set(def_img);
			ctx.putImageData(imgdata,0,0);
			//TODO:: Check if the image size is same
		    }
		}
		else{
		    print(str + "`" + "There was error in receiving data" + "`" );
		    console.log();
		}
	    }
        }
        ws.onerror = function(evt) {
	    print("ERROR: " + evt.data);
        }
        return false;
    };

    document.getElementById("send").onclick = function(evt) {
        if (!ws) {
	    return false;
        }
        print("SEND: " + input.value);
        ws.send(input.value);
        return false;
    };
    document.getElementById('send-collect').
	addEventListener('click', (evt) => {
	    const N = frame_collection.frames.length
	    const M = slider_frame_count;
	    
	    const arr = [];
	    for(var i = 0; i < M; ++i){
		const j = Math.floor(i * N / M + (N-M)/M);
		arr.push(frame_collection.frames[j]);
	    }
	    frame_collection.collecting = false;
	    
	    // Send the frames
	    if (!ws) {
		return false;
            }
	    
	    arr.forEach((imgdata) => {
		const sizeinput = new BigUint64Array([BigInt(imgdata.width),
						      BigInt(imgdata.height),
						      BigInt(imgdata.data.buffer.byteLength)]);
		print("SEND: " + sizeinput);
		//ws.send(sizeinput);
		//ws.send(imgdata.data);
		ws.send(concatenate(sizeinput, imgdata.data));
	    });
	    
	});



    document.getElementById("close").onclick = function(evt) {
        if (!ws) {
	    return false;
        }
        ws.close();
        return false;
    };

    function concatenate(arr1, arr2){
	const len = arr1.buffer.byteLength + arr2.buffer.byteLength;
	const res = new Uint8Array(len);
	res.set(new Uint8Array(arr1.buffer), 0);
	res.set(new Uint8Array(arr2.buffer), arr1.buffer.byteLength);
	return res;
    }

    function send_canvas(){
        if (!ws) {
	    return false;
        }
	// send width, height in pixels as u64
	// Maybe send also total size/channel count

	const imgdata = ctx.getImageData(0, 0, canvas.width, canvas.height);
	// TODO:: Test if the machine is big or little endian when sending such 64 bit ints
	//        for now, assume it is little endian
	const sizeinput = new BigUint64Array([BigInt(imgdata.width),
					      BigInt(imgdata.height),
					      BigInt(imgdata.data.buffer.byteLength)]);
        print("SEND: " + sizeinput);
	//ws.send(sizeinput);
        //ws.send(imgdata.data);
	ws.send(concatenate(sizeinput, imgdata.data));
        return false;
    };
    
    document.getElementById("sendcanvas").onclick = (evt) => {send_canvas();}


    // Start webcam stream
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
	.then((stream) => {
	    video.controls = true;
	    video.loop = true;
	    video.srcObject = stream;
	    video.play();
	    const streaming = [false];
	    const playvideo = [false];

	    
	    // Make all the event listeners functions, so that they can be added and removed
	    const video_click_fn = (evt) => {
		if(playvideo[0]){
		    video.pause();
		}
		else{
		    video.play();
		}
		playvideo[0] = !playvideo[0];
	    };
	    const to_camera_fn = (evt)=>{
		stream.getTracks().forEach(function(track) {
		    track.enabled = true;
		});
		video.src = null;
		video.srcObject = stream;
		video.play();
		//switch_camera();
		streaming[0] = false;
	    };
	    const choose_file_fn = (evt)=>{
		const vfile = document.getElementById('choose_file_to_play');
		const file = vfile.files[0];
		if (file.type.indexOf('video') === -1) {
		    console.log('Not a video file');
		    return;
		}
		const reader = new FileReader();
		reader.onload = function() {
		    const blob = new Blob([new Uint8Array(reader.result)]);
		    const url = URL.createObjectURL(blob);
		    stream.getTracks().forEach(function(track) {
			track.enabled = false;
		    });
		    video.srcObject = null;
		    video.src = url;
		    video.play();
		    //switch_camera();
		    streaming[0] = false;
		    console.log("There was a file at " + url);
		    canvas_click_fn();
		};
		reader.readAsArrayBuffer(file);

	    };
	    const capture_img_fn = (evt) => {
		ctx.drawImage(video, 0, 0, vid_dims.width, vid_dims.height);
		evt.preventDefault();
	    };
	    const canvas_click_fn = () => {
		if(scheduler_obj === null){
		    scheduler_obj = setInterval(() => {
			ctx.drawImage(video, 0, 0, vid_dims.width, vid_dims.height);
			if(frame_collection.collecting){
			    frame_collection.frames.
				push(ctx.getImageData(0, 0, canvas.width, canvas.height));
			}
			else{
			    send_canvas();
			}
		    }, 1000/scheduler_fps);
		}
		else{
		    clearInterval(scheduler_obj);
		    scheduler_obj = null;
		}
	    };
	    const slider_input_fn = (evt)=>{
		var scheduler_fps = document.getElementById('slider').value;
		document.getElementById('sliderValue').textContent = ''+scheduler_fps;
		clearInterval(scheduler_obj);
		scheduler_obj = setInterval(() => {
		    ctx.drawImage(video, 0, 0, vid_dims.width, vid_dims.height);
		    send_canvas();
		}, 1000/scheduler_fps);
	    };
	    

	    // Accumulation of frames portion
	    document.getElementById('start-collect').
		addEventListener('click', (evt) => {
		    frame_collection.frames = [];
		    frame_collection.collecting = true;
		    document.getElementById("collecting-or-not").textContent = 'Collecting';
		    // Should also start video capture callback itself
		    if(!playvideo[0]){
			video.play();
			playvideo[0] = !playvideo[0];
		    }
		    if(scheduler_obj === null){
			canvas_click_fn();
		    }
		});

	    document.getElementById('stop-collect').
		addEventListener('click', (evt) => {
		    frame_collection.collecting = false;
		    document.getElementById("collecting-or-not").textContent = 'Not Collecting';
		    // Should also stop video capture callback itself

		    if(scheduler_obj !== null){
			canvas_click_fn();
		    }
		});

	    

	    video.addEventListener(
		"canplay",
		(ev) => {
		    if (!streaming[0]) {

			video.addEventListener('click', video_click_fn);

			function switch_camera(){
			    //video = document.getElementById('webcam');
			    canvas = document.getElementById('paintCanvas');
			    ctx = canvas.getContext('2d');

			    video = document.getElementById('webcam');
			    vid_dims.height = (video.videoHeight / video.videoWidth) * vid_dims.width;
			    video.setAttribute("width", vid_dims.width);
			    video.setAttribute("height", vid_dims.height);
			    canvas.setAttribute("width", vid_dims.width);
			    canvas.setAttribute("height", vid_dims.height);

			}
			document.getElementById('switch_to_camera').
			    addEventListener('click', to_camera_fn);
			
			document.getElementById('choose_file_to_play').
			    addEventListener('change', choose_file_fn);

			switch_camera();			
			streaming[0] = true;
			document.getElementById('captureimg').
			    addEventListener('click', capture_img_fn);
			// TODO:: Add whole stream pause/play also
			canvas.addEventListener('click', canvas_click_fn);
			document.getElementById('slider').addEventListener('input', slider_input_fn);
			if(scheduler_obj === null){
			    canvas_click_fn();
			}
		    }
		},
		false,
	    );
	    
	})
	.catch((err) => {
	    console.error(`An error occurred: ${err}`);
	});

    // Set initial drawing state
    let painting = false;

    // Start painting function
    function startPosition(e) {
	painting = true;
	draw(e);  // Draw immediately when the mouse is pressed
    }

    // End painting function
    function endPosition() {
	painting = false;
	ctx.beginPath();  // Start a new path when the mouse is released
    }
    var currentColor = 'white';
    // Draw function
    function draw(e) {
	if (!painting) return;

	// Get mouse position relative to the canvas
	const x = e.clientX - canvas.offsetLeft;
	const y = e.clientY - canvas.offsetTop;

	// Draw a line from the last position to the new position
	ctx.lineWidth = 5;  // Set line width
	ctx.lineCap = 'round';  // Round line endings
	ctx.strokeStyle = currentColor;  // Set the selected color

	ctx.lineTo(x, y);  // Draw a line to the new position
	ctx.stroke();  // Actually render the line
	ctx.beginPath();  // Start a new path
	ctx.moveTo(x, y);  // Move to the current mouse position
    }

    // Event listeners for mouse actions
    canvas.addEventListener('mousedown', startPosition);  // When mouse is pressed
    canvas.addEventListener('mouseup', endPosition);      // When mouse is released
    canvas.addEventListener('mousemove', draw);           // When mouse is moved
    // Change stroke color based on button click
    function setColor(color) {
	currentColor = color;
    }
    // Optional: Clear the canvas with a keyboard shortcut (e.g., press 'C' to clear)
    window.addEventListener('keydown', function(e) {
	if (e.key === 'c' || e.key === 'C') {
            ctx.clearRect(0, 0, canvas.width, canvas.height);  // Clear the canvas
	}
    });
});
