#!/usr/bin/env python
# echo-server.py

import socket
import sys
import time

import numpy
#import tensorflow as tflow
#import keras
import logpy

import stsae_gcn
import try_mpipe

    
def get_img_prediction(rgba_data, width, height):
    # Convert RGBA byte array to numpy array and reshape it (assuming 4 channels for RGBA)
    rgba_array = numpy.frombuffer(rgba_data, dtype=numpy.uint8).reshape((1, height, width, 4))
    # Extract RGB values by removing the Alpha channel
    rgb_array = rgba_array[:, :, :, :3]

    # Normalize the RGB values to the range [0, 1]
    # rgb_normalized = rgb_array.astype(numpy.float32) / 255.0
    res, img =  try_mpipe.run_on_image(rgb_array)
    return res, img


HOST = "127.0.0.1"  # Standard loopback interface address (localhost)
PORT = 42024  # Port to listen on (non-privileged ports are > 1023)

# 1. Retrieve the port number passed from the Go process
if len(sys.argv) != 2:
    print("Usage: python3 python_script.py <port>")
    sys.exit(1)

port = int(sys.argv[1])

logpy.log(f"Going to connect to port on localhost:{port}")

# 2. Connect to the Go server on the provided port
conn = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
conn.connect(('localhost', port))  # Connect to the Go server

logpy.log(f"Connected to Go server on port {port}")

#with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
#print(f"Going to bind it")
#s.bind((HOST, PORT))
#s.listen()
#conn, addr = s.accept()
#print(f"Going to start it")

def receive_full(conn, size):
    dats = b''
    while len(dats) < size:
        recvd = conn.recv(size-len(dats))
        dats = dats + recvd
    return dats

with conn:
    while True:
        #while True:
        wid = receive_full(conn, 8)
        hei = receive_full(conn, 8)
        if (not wid) or (not hei):
           break
        wid = int.from_bytes(wid, byteorder='little', signed=False)
        hei = int.from_bytes(hei, byteorder='little', signed=False)
        tots = wid * hei * 4
        img = receive_full(conn, tots)
        if img:
            # predict something
            pred, pimg = get_img_prediction(img, wid, hei)
            prediction = bytes(pred, 'utf-8')
            prediction = (len(prediction)).to_bytes(8, byteorder='little') + prediction
            logpy.log(f"Sending prediction of length {len(prediction)}")
            conn.sendall(prediction)
            logpy.log(f"The prediction was sent");
            if not(pimg is None):
                img = pimg.tobytes()
            logpy.log(f"Sending img of length {len(img)}")
            conn.sendall(img)
            logpy.log(f"The image data was sent");
            
