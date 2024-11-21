function make_video_object(obj_id, width=null, height=null,  options = {controls : true, loop : false}){

    // Event callbacks are dicts of obj, type, func fields
    //   obj being null implies use this video obj
    // Others are hooks to be used in begin and end, that take this video object as input
    
    const self = {
	obj: document.getElementById(obj_id),
	evt_callbacks : [], // Array of event callbacks dependent on this being active
	init_callbacks : [], // These persist over callbacks
	deinit_callbacks : [], // These have to be setup by init_callbacks, will be cleared
	//play_pause_hooks : [], // are passed in this object and called when play()/pause() is called
    };
    self.obj.controls = options.controls;
    self.obj.loop = options.loop;

    const inited={b:false};
    
    self.pause = () => {
	if(!inited.b || !self.obj.playing) return;
	self.obj.pause();
	// self.play_pause_hooks.forEach((func) => {
	//     func(self);
	// });
    };
    
    self.play = () => {
	if(!inited.b || self.obj.playing) return;
	self.obj.play();
	// self.play_pause_hooks.forEach((func) => {
	//     func(self);
	// });
    };
    
    const init_hook = (evt) => {

	if((width === null) && (height !== null)){
	    self.obj.height = height;
	    self.obj.width = (self.obj.videoWidth / self.obj.videoHeight) * height;
	}
	else if((width !== null) && (height === null)){
	    self.obj.width = width;
	    self.obj.height = (self.obj.videoHeight / self.obj.videoWidth) * width;
	}
	else{
	    self.obj.width = self.obj.videoWidth;
	    self.obj.height = self.obj.videoHeight;
	}
	
	
	// Initialize all callbacks to be setup here
	self.init_callbacks.forEach((func) => {
	    func(self);
	});
	self.evt_callbacks.forEach((da_obj) => {
	    if(da_obj.obj === null){
		self.obj.addEventListener(da_obj.type, da_obj.func);
	    }
	    else{
		da_obj.obj.addEventListener(da_obj.type, da_obj.func);
	    }
	});

	// Autoplay video
	self.play();
	
	self.obj.removeEventListener('canplay', init_hook);
	inited.b = true;
    }
    const init_func = () => {
	self.obj.addEventListener('canplay', init_hook);
    };
    const deinit_func = () => {
	self.pause();

	self.evt_callbacks.forEach((da_obj) => {
	    if(da_obj.obj === null){
		self.obj.removeEventListener(da_obj.type, da_obj.func);
	    }
	    else{
		da_obj.obj.removeEventListener(da_obj.type, da_obj.func);
	    }
	});
	self.deinit_callbacks.forEach((func) => {
	    func(self);
	});
	self.deinit_callbacks = [];
	self.play_pause_hooks = [];
	inited.b = false;
    }
    self.obj.addEventListener('end', deinit_func);

    self.switch_source = (source/* either 'camera', or file path/object*/)=>{
	if(source === 'camera'){
	    // Start webcam stream
	    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
		.then((stream) => {
		    deinit_func();
		    self.obj.src = null;
		    self.obj.srcObject = stream;

		    init_func();
		    // Set to disable each camera tracks on deinit
		    self.deinit_callbacks.push(()=>{
			stream.getTracks().forEach((track)=>{
			    track.enabled = false;
			});
		    });
		    // Enable each tracks just in case
		    stream.getTracks().forEach((track)=>{
			track.enabled = true;
		    });
		});
	}
	else{
	    if (source.type.indexOf('video') === -1) {
		console.log('Not a video file');
		return;
	    }
	    const reader = new FileReader();
	    reader.onload = ()=>{
		const blob = new Blob([new Uint8Array(reader.result)]);
		const url = URL.createObjectURL(blob);
		deinit_func();
		self.obj.srcObject = null;
		self.obj.src = url;
		init_func();
	    };
	    reader.readAsArrayBuffer(source);
	}
    }
    
    return self;
}

// canvas being null makes new canvas offline
// image_source also must have width and height as field
function make_capturing_canvas(image_source, canvas = null){
    const self = {
	canvas : canvas,
	ctx : null,
	src : image_source,
	timed_capturer: null,
    };
    if(self.canvas === null) self.canvas = new OffscreenCanvas(self.src.width, self.src.height);

    self.canvas.width = self.src.width;
    self.canvas.height = self.src.height;
    self.ctx = self.canvas.getContext('2d');

    // For standalone image capture
    self.capture_image = () => {
	self.canvas.width = self.src.width;
	self.canvas.height = self.src.height;
	self.ctx.drawImage(self.src, 0, 0, self.src.width, self.src.height);
	const imgdata = self.ctx.getImageData(0, 0, self.canvas.width, self.canvas.height);
	return imgdata;
    };

    // For timed image capture
    self.interval_capture = (fps, evt_fn) => {
	self.stop_capture();
	self.timed_capturer = setInterval(() => {
	    const imgdata = self.capture_image();
	    evt_fn(imgdata);
	}, 1000/fps);
    };
    self.stop_capture = () => {
	if(self.timed_capturer !== null) clearInterval(self.timed_capturer);
	self.timed_capturer = null;
    };
    return self;
}

function create_websocket(address, options={
    ontext: (() => {}),
    onbinary: (() => {}),
    onopen: (() => {}),
    onclose: (() => {}),
}){
    const self = {
	obj: null,
	initialized: false,
	ontext:options.ontext,
	onbinary:options.onbinary,
	onopen:options.onopen,
	onclose:options.onclose,
    };

    self.connect = async () => {
	if(self.obj === null) self.obj = new WebSocket(address);
	//self.obj.addEventListener('open', (evt) => {
	self.obj.onopen = (evt) => {
	    self.initialized = true;
	    if(null !== self.onopen) self.onopen(evt);
	};
	//self.obj.addEventListener('close', (evt) => {
	self.obj.onclose = (evt) => {
	    if(null !== self.onclose) self.onclose(evt);
	    // self.obj.onopen = null;
	    // self.obj.onclose = null;
	    // self.ontext = null;
	    // self.onbinary = null;
	    // self.obj.removeEventListener('message', onmessage);
	    self.initialized = false;
	};
	self.obj.addEventListener('message', onmessage);
    };
    self.disconnect = async () => {
	if(self.obj !== null){
	    self.obj.close();
	    self.obj = null;
	}
    };

    const onmessage = async (evt)=>{
	if(typeof(evt.data) == 'string'){
	    if(self.ontext !== null) self.ontext(evt.data);
	}
	else{
	    console.log('Type of evt.data is ', typeof(evt.data));
	    console.log('evt.data is ', evt.data);
	    console.log('evt.data.bytes is ', evt.data.bytes);
	    if(self.onbinary !== null)
		await self.onbinary(new Uint8Array(await evt.data.arrayBuffer()));
	}
    };
    self.sendtext = (string) => {
	if(self.initialized) self.obj.send(String(string));
	return self.initialized;
    };
    self.sendbinary = (arrays) => {
	if(!self.initialized) return false;
	const len = {
	    curr: 0,
	    tots: 0
	};
	arrays.forEach((array) => {
	    len.tots += array.buffer.byteLength;
	});
	const buf = new Uint8Array(len.tots);
	arrays.forEach((array) => {
	    buf.set(new Uint8Array(array.buffer), len.curr);
	    len.curr += array.buffer.byteLength;
	});
	
	self.obj.send(buf);
	return true;
    };
    // TODO:: Implement on error also
    return self;
}

function make_biguint_array(numbers){
    const wrapped_arr = numbers.map((n) => BigInt(n));
    return new BigUint64Array(wrapped_arr);
}

//TODO :: Make a deserialization work


function adapt_slider(slider_id, show_id){
    const self = {
	obj: document.getElementById(slider_id),
	show_obj: document.getElementById(show_id),
    };
    self.show_obj.textContent = self.obj.value;
    self.obj.addEventListener('input', (evt) => {
	self.show_obj.textContent = ''+self.obj.value;
    });
    

    return self;
}

function make_sampler(){
    const self = {
	items: [],
	collecting: false
    };

    self.begin_collecting = ()=>{
	self.items = [];
	self.collecting = true;
    };
    self.end_collecting = ()=>{
	self.collecting = false;
    };
    self.collect = (item)=>{
	self.items.push(item);
    };
    self.get_sample = (index, total)=>{
	const N = self.items.length;
	const M = total;

	const j = Math.floor(index * N / M + (N-M)/M);
	return self.items[j];
    };
    return self;
}
