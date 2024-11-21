// Assume other js file is loaded too
function get_elem(id){
    return document.getElementById(id);
}

function add_listener(id, type, evt, options = null){
    return document.getElementById(id).addEventListener(type, evt, options);
}

const context = {
    ws:undefined,
    video:undefined,
    stream_canvas:undefined,
    stream_fps:undefined,
    accumulate_canvas:undefined,
    accumulate_frames:undefined,
    frame_samples:undefined,
};

const func = async (evt) => {
    const ws = create_websocket("{{.}}");
    add_listener('connect-ws-button', 'click', ws.connect);
    add_listener('disconnect-ws-button', 'click', ws.disconnect);
    ws.onopen = () => {console.log('Connected via websocket');console.trace();};
    ws.onclose = () => {console.log('Websocket connection closed');console.trace();};


    // Setup video
    const video = make_video_object('video-src', width=400);
    add_listener('switch-to-camera-button', 'click', ()=>video.switch_source('camera'));
    add_listener('choose-file-field', 'change', () => {
	video.switch_source(get_elem('choose-file-field').files[0]);
    });

    //Setup streaming canvas
    const stream_canvas = make_capturing_canvas(video.obj);
    const stream_fps = adapt_slider('stream-fps-slider', 'stream-fps-val');
    video.evt_callbacks.push({obj:get_elem('capture-image-on-streaming'), type:'click',
			      func:()=>{
				  const img = stream_canvas.capture_image();
				  const dims = make_biguint_array(
				      [img.width, img.height,
				       img.data.buffer.byteLength]);
				  ws.sendbinary([dims, img.data]);
			      }});
    video.evt_callbacks.push({obj:get_elem('begin-streaming'), type:'click',
			      func:()=>{
				  stream_canvas.interval_capture
				  (stream_fps.obj.value,
				   (img)=>{
				       if(!video.obj.paused){
					   const dims = make_biguint_array(
					       [img.width, img.height,
						img.data.buffer.byteLength]);
					   ws.sendbinary([dims, img.data]);
				       }
				   });
				  video.play();
			      }});
    video.evt_callbacks.push({obj:get_elem('end-streaming'), type:'click',
			      func:()=> stream_canvas.stop_capture()});
    
    //Setup accumulating canvas
    const accumulate_canvas = make_capturing_canvas(video.obj);
    const accumulate_frames = adapt_slider('accumulate-frame-slider', 'accumulate-frame-val');
    const frame_samples = make_sampler();
    video.evt_callbacks.push({obj:get_elem('begin-accumulation'), type:'click',
			      func:()=>{
				  frame_samples.begin_collecting();
				  accumulate_canvas.interval_capture
				  (stream_fps.obj.value,
				   (img)=>{
				       if(!video.obj.paused){
					   frame_samples.collect(img);
				       }
				   });
				  get_elem('accumulation-state').textContent = 'Collecting';
				  video.play();
			      }});
    video.evt_callbacks.push({obj:get_elem('end-accumulation'), type:'click',
			      func:()=> {
				  get_elem('accumulation-state').textContent = 'Not Collecting';
				  frame_samples.end_collecting();
				  accumulate_canvas.stop_capture();
			      }});
    add_listener('submit-accumulated-frames', 'click', async (evt)=>{
	if(ws.initialized){
	    const M = accumulate_frames.obj.value;
	    for(let i = 0; i < M; ++i){
		const img = frame_samples.get_sample(i, M);
		const dims = make_biguint_array(
		    [img.width, img.height,
		     img.data.buffer.byteLength]);
		ws.sendbinary([dims, img.data]);
	    }
	}
    });

    
    
    //Setup receiving canvas and prediction show item
    ws.ontext = (text) =>{
	get_elem('prediction-result-item').textContent = text;
	console.log("RESPONSE: " + text);
    };
    ws.onbinary = async(array)=>{
	console.log("This array was received of size : ", array.length);
	console.log("This array was received : ", array);
	// Try to parse as image, then publish to canvas
	if(array.length >= 3*8){
	    const args = new BigUint64Array(array.slice(0,3*8).buffer);
	    const prob_img = new Uint8ClampedArray(array.slice(3*8).buffer);
	    
	    console.log("`" + args + "`" +
		  ((prob_img.length < Number(args[2]))?"Length not enough":""));

	    const width = Number(args[0]);
	    const height = Number(args[1]);
	    const size = Number(args[2]);
	    
	    if((prob_img.length >= size) && (width*height*4 == size)){
		
		const canvas = get_elem('prediction-result-canvas');
		canvas.width = width;
		canvas.height = height;
		const ctx = canvas.getContext('2d');

		def_img = prob_img.slice(0,Number(args[2]));
		const imgdata = ctx.getImageData(0, 0, canvas.width, canvas.height);
		imgdata.data.set(def_img);
		ctx.putImageData(imgdata,0,0);
	    }
	}
	else{
	    console.log("`" + "There was error in receiving data" + "`" );
	}
    };

    ws.connect();
    
    context.ws = ws;
    context.video = video;
    context.stream_canvas = stream_canvas;
    context.stream_fps = stream_fps;
    context.accumulate_canvas = accumulate_canvas;
    context.accumulate_frames = accumulate_frames;
    context.frame_samples = frame_samples;

};
window.addEventListener("load", func);
    



