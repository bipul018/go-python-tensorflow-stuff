package main

import(
	"flag"
	"html/template"
	txt_template "text/template"
	"log"
	"net/http"
	"net"
	"context"
	"time"
	"encoding/binary"
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"os/signal"
	"syscall"
	"strconv"

	"github.com/gorilla/websocket"
	//"github.com/pytorch/go-torch"
	// torch "github.com/wangkuiyi/gotorch"
	
	// "github.com/wangkuiyi/gotorch/vision/models"
	//"github.com/pytorch/go-torch/torchvision"
)



// func loadModel(modelFn string) *models.MLPModule {
// 	f, e := os.Open(modelFn)
// 	if e != nil {
// 		log.Fatal(e)
// 	}
// 	defer f.Close()

// 	states := make(map[string]torch.Tensor)
// 	if e := gob.NewDecoder(f).Decode(&states); e != nil {
// 		log.Fatal(e)
// 	}

// 	net := models.MLP()
// 	net.SetStateDict(states)
// 	return net
// }

var tcp_conn net.Conn

func predict_class(img [] byte, width uint64, height uint64) string{
	// Connect to a socket on 127.0.0.1:42042, send and receive data
	//conn, err := net.Dial("tcp", "localhost:42042")
	//
	//if err != nil {
	//fmt.Println(err)
	//return "Error"
	//}


	// Send some data to the server
	b := make([]byte, 8)
	binary.LittleEndian.PutUint64(b, uint64(width))
	_, err := tcp_conn.Write(b)
	if err != nil {
		fmt.Println(err)
		return "Error"
	}
	binary.LittleEndian.PutUint64(b, uint64(height))
	_, err = tcp_conn.Write(b)
	if err != nil {
		fmt.Println(err)
		return "Error"
	}

	log.Printf("Writing bytes of size : %d\n", len(img))
	_, err = tcp_conn.Write(img)
	if err != nil {
		fmt.Println(err)
		return "Error"
	}

	// Read incoming data
	_, err = tcp_conn.Read(b)
	if err != nil {
		fmt.Println(err)
		return "Error"
	}
	dalen := binary.LittleEndian.Uint64(b)

	//log.Printf("Hello, going to make slice of %d\n", dalen)
	
	ans := make([]byte, dalen)
	_, err = tcp_conn.Read(ans)
	if err != nil {
		fmt.Println(err)
		return "Error"
	}
	//conn.Close()
	return string(ans)
	
	
	//	// This forwards data to a python process and gets the result
	//	
	//	model := loadModel("GharudxD-Chess-object-detection.pt")
	//	//defer model.Close()
	//
	//	// Define the transformations for the input images
	//	// transforms := torchvision.Transforms{
	//	// 	torchvision.ToTensor(),
	//	// 	//torchvision.Normalize([]float32{0.5, 0.5, 0.5}, []float32{0.5, 0.5, 0.5}),
	//	// }
	//
	//	//input := transforms.Apply(img)
	//	input := torch.FromBlob(unsafe.Pointer(&img[0]), torch.Byte, []int64{width,height,4})
	//
	//	// Perform inference with the model
	//	output := model.Forward(input)
	//
	//	// Get the predicted class
	//	//_, predictedClass := torch.Max(output, 1)
	//	predictedClass := output.Argmax();
	//
	//	// Map the class index to the class name
	//	classNames := []string{"Bishop", "King", "Queen", "Knight"}
	//	className := classNames[predictedClass.Item().(int64)]
	//
	//	return className;
}

var(web_addr, web_port string)

var upgrader = websocket.Upgrader{} // use default options

func echo(w http.ResponseWriter, r *http.Request) {
	c, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Print("upgrade:", err)
		return
	}
	defer c.Close()
	for {
		mt, message, err := c.ReadMessage()
		if err != nil {
			log.Println("read:", err)
			break
		}
		if mt == websocket.TextMessage {
			log.Printf("recv text : %s" , message)

			err = c.WriteMessage(mt, message)
			if err != nil {
				log.Println("write:", err)
				break
			}
		} else {
			// Decode i64 messages
			// first is width, second is height, thir is length of bytes
			width := binary.LittleEndian.Uint64(message[0:8])
			height := binary.LittleEndian.Uint64(message[8:16])
			bytes := binary.LittleEndian.Uint64(message[16:24])
			//log.Printf("recv image : width=%d, height=%d, bytes=%d", width, height, bytes);

			img := message[24:(24+bytes)];
			log.Printf("Going to predict %d\n", len(img))
			className := predict_class(img, width, height)
			log.Println("prediction:", className)
			err = c.WriteMessage(websocket.TextMessage, []byte(className))
			if err != nil {
				log.Println("write:", err)
				break
			}
			// Later maybe modify and relpy also the data
			//for i:=0; i<(len(img)/4); i++ {
			//img[i*4+0] = 0 // byte(float32(img[i*4+0]) * 1.5);
			//img[i*4+3] = 255
			//}
		}

	}
}


func home_js(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/javascript")
	jsTemplate.Execute(w, "ws://"+r.Host+"/echo")
}

func home_html(w http.ResponseWriter, r *http.Request) {
	htmlTemplate.Execute(w, "")
}

func main() {
	flag.StringVar(&web_addr,"web_addr", "localhost", "http service address")
	flag.StringVar(&web_port,"web_port", "8080", "http service port")
	// flag.StringVar(&python_port,"py_port","42024", "python service port")
	flag.Parse()
	log.SetFlags(0)

	// 1. Start a TCP server and get the available port
	ln, err := net.Listen("tcp", ":0") // ":0" means choose any available port
	if err != nil {
		log.Fatal("Error starting TCP server for python:", err)
	}
	defer ln.Close()

	// Get the port number that was assigned
	port := ln.Addr().(*net.TCPAddr).Port
	fmt.Printf("Server for python started on port %d\n", port)

	exec.Command("echo", os.Getenv("PATH"))
	

	var python_path string
	{
		// For Unix-like systems (Linux/macOS), use "which"
		// For Windows, use "where"
		var cmd *exec.Cmd
		if runtime.GOOS == "windows" {
			cmd = exec.Command("where", "python")
		} else {
			cmd = exec.Command("which", "python")
		}

		pythonPathBytes, err := cmd.CombinedOutput()
		if err != nil {
			log.Fatalf("Error finding Python executable: %v", err)
		}

		// Get the first line of the output, trim any whitespace
		python_path = strings.TrimSpace(strings.Split(string(pythonPathBytes), "\n")[0])

		if python_path == "" {
			log.Fatal("Python executable not found.")
		}
	}

	cmd := exec.Command(python_path, "main.py", strconv.Itoa(port))
	//cmd = exec.Command("echo", "$(which go)")
	// Pipe the output from the Python process to the Go program's stdout
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	
	err = cmd.Start()
	if err != nil {
		log.Fatal("Error starting Python process:", err)
	}
	defer cmd.Wait() // Ensure the Python process is terminated when the Go process exits

	// 3. Accept the first connection (this will be from Python)
	conn, err := ln.Accept()
	if err != nil {
		log.Fatal("Error accepting connection from python process:", err)
	}
	// defer conn.Close()
	// conn, err := net.Dial("tcp", "localhost:"+python_port)
	// if err != nil {
	// 	fmt.Println(err)
	// 	return
	// }
	tcp_conn = conn
	defer tcp_conn.Close()

	

	http.HandleFunc("/echo", echo)
	http.HandleFunc("/index.js", home_js)
	http.HandleFunc("/", home_html)
	log.Println("Starting server...")

	// Setting up signal capturing
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt)

	server := &http.Server{Addr: web_addr+":"+web_port, Handler: nil}
	
	go func() {
		if err := server.ListenAndServe(); err != nil {
			// handle err
			log.Println("Error: ", err)
			stop <- syscall.SIGINT
		}
	}()


	// Waiting for SIGINT (kill -2)
	<-stop

	
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := server.Shutdown(ctx); err != nil {
		log.Println("Error: ", err)
	}
	//log.Fatal(http.ListenAndServe(web_addr+":"+web_port, nil))
	
	// 5. Terminate the Python process (forcefully)
	err = cmd.Process.Kill()
	if err != nil {
		log.Fatal("Error killing Python process:", err)
	}

	// 6. Exit the Go process
	fmt.Println("Terminating Python process and exiting Go process")
}


var htmlTemplate = template.Must(template.ParseFiles("index.html"))
//var jsTemplate = template.Must(template.ParseFiles("index.js"))
var jsTemplate = txt_template.Must(txt_template.ParseFiles("index.js"))
