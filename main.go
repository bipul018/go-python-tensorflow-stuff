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
)

var log_inx = 0
func my_logf(format string, args ...interface{}) {
	fmt.Printf("LOG GO %5d::", log_inx)
	fmt.Printf(format, args...)
	fmt.Printf("\n")
	log_inx++
}

var err_inx = 0
func my_errf(format string, args ...interface{}) {
	fmt.Printf("ERR GO %5d::", err_inx)
	fmt.Printf(format, args...)
	fmt.Printf("\n")
	err_inx++
}

func dup_tcp_write(conn net.Conn, slice [] byte) (int, error){
	n, err := conn.Write(slice)
	if err != nil {
		return n, err
	}
	if n != len(slice){
		my_errf("Incomplete writing of slice on connection, tried to write %d, wrote %d",
			len(slice), n)
	}
	
	return n, nil	
}

func read_all(conn net.Conn, slice [] byte) (int,error){
	read_bytes := 0
	for read_bytes < len(slice) {
		rb, err := tcp_conn.Read(slice[read_bytes:])
		if err != nil {
			return read_bytes, err
		}
		read_bytes += rb
	}
	return read_bytes, nil
}

var tcp_conn net.Conn
// TODO:: Write/Read can just not do full transaction maybe ??
func predict_class(img [] byte, width uint64, height uint64) string{
	// Send some data to the server
	b := make([]byte, 8)
	binary.LittleEndian.PutUint64(b, uint64(width))
	_, err := dup_tcp_write(tcp_conn, b)
	if err != nil {
		my_errf("", err)
		return "Error"
	}
	binary.LittleEndian.PutUint64(b, uint64(height))
	_, err = dup_tcp_write(tcp_conn, b)
	if err != nil {
		my_errf("", err)
		return "Error"
	}

	//my_logf("Writing bytes of size : %d\n", len(img))
	_, err = dup_tcp_write(tcp_conn, img)
	if err != nil {
		my_errf("", err)
		return "Error"
	}

	// Read incoming data
	_, err = read_all(tcp_conn, b)
	if err != nil {
		my_errf("", err)
		return "Error"
	}
	dalen := binary.LittleEndian.Uint64(b)

	//my_logf("Hello, going to make slice of %d\n", dalen)
	
	ans := make([]byte, dalen)
	_, err = read_all(tcp_conn, ans)
	if err != nil {
		my_errf("", err)
		return "Error"
	}

	my_logf("Reading image from python of size : %d\n", len(img))
	read_bytes, err := read_all(tcp_conn, img)
	if err != nil {
		my_errf("", err)
		return "Error"
	}
	my_logf("Read image from python of size : %d\n", read_bytes)	
	
	return string(ans)
}

var(web_addr, web_port string)

var upgrader = websocket.Upgrader{} // use default options

func echo(w http.ResponseWriter, r *http.Request) {
	c, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		my_errf("upgrade:", err)
		return
	}
	defer c.Close()
	for {
		mt, message, err := c.ReadMessage()
		if err != nil {
			my_logf("read:", err)
			break
		}
		if mt == websocket.TextMessage {
			my_logf("recv text : %s" , message)

			err = c.WriteMessage(mt, message)
			if err != nil {
				my_logf("write:", err)
				break
			}
		} else {
			// Decode i64 messages
			// first is width, second is height, thir is length of bytes
			width := binary.LittleEndian.Uint64(message[0:8])
			height := binary.LittleEndian.Uint64(message[8:16])
			bytes := binary.LittleEndian.Uint64(message[16:24])
			//my_logf("recv image : width=%d, height=%d, bytes=%d", width, height, bytes);

			img := message[24:(24+bytes)];
			//my_logf("Going to predict %d\n", len(img))
			className := predict_class(img, width, height)
			my_logf("prediction: %s", className)
			err = c.WriteMessage(websocket.TextMessage, []byte(className))
			if err != nil {
				my_errf("write:", err)
				break
			}
			// Later maybe modify and relpy also the data
			//for i:=0; i<(len(img)/4); i++ {
			//img[i*4+0] = 0 // byte(float32(img[i*4+0]) * 1.5);
			//img[i*4+3] = 255
			//}

			// Replaying data
			err = c.WriteMessage(mt, message)
			if err != nil {
				my_errf("write:", err)
				break
			}
		}

	}
}


func home_css(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/css")
	cssTemplate.Execute(w, "")
}


func main_js(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/javascript")
	jsmainTemplate.Execute(w, "ws://"+r.Host+"/echo")
}
func helper_js(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/javascript")
	jshelpTemplate.Execute(w, "")
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
	my_logf("Server for python started on port %d\n", port)

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
	// 	my_errf("", err)
	// 	return
	// }
	tcp_conn = conn
	defer tcp_conn.Close()

	

	http.HandleFunc("/echo", echo)
	http.HandleFunc("/index.js", main_js)
	http.HandleFunc("/helper.js", helper_js)
	http.HandleFunc("/styles.css", home_css)
	http.HandleFunc("/", home_html)
	my_logf("Starting server...")

	// Setting up signal capturing
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt)

	server := &http.Server{Addr: web_addr+":"+web_port, Handler: nil}
	
	go func() {
		if err := server.ListenAndServe(); err != nil {
			// handle err
			my_errf("", err)
			stop <- syscall.SIGINT
		}
	}()


	// Waiting for SIGINT (kill -2)
	<-stop

	
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := server.Shutdown(ctx); err != nil {
		my_errf("", err)
	}
	//log.Fatal(http.ListenAndServe(web_addr+":"+web_port, nil))
	
	// 5. Terminate the Python process (forcefully)
	err = cmd.Process.Kill()
	if err != nil {
		log.Fatal("Error killing Python process:", err)
	}

	// 6. Exit the Go process
	my_logf("Terminating Python process and exiting Go process")
}


var htmlTemplate = template.Must(template.ParseFiles("index.html"))
//var jsTemplate = template.Must(template.ParseFiles("index.js"))
var jsmainTemplate = txt_template.Must(txt_template.ParseFiles("index.js"))
var jshelpTemplate = txt_template.Must(txt_template.ParseFiles("helper.js"))
var cssTemplate = txt_template.Must(txt_template.ParseFiles("styles.css"))
