#!/usr/bin/env python
# echo-server.py

import socket
import sys
import time

import numpy
import tensorflow as tflow
import keras

TGT_IMG_SIZE = (300, 300)
BATCH_SIZE = 64
LOADER_METADATA = {'batch_size':64, 'interpolation':"bilinear", 'image_size':TGT_IMG_SIZE, 'label_mode':'binary'}

# load model
# model = keras.models.load_model("/ntfsd/prgming/python-test/rock-paper-scissor-with-validation-2.keras")
model = keras.models.load_model("rock-paper-scissor-with-validation-2.keras")

def preprocess(xval, yval):
    xval = xval / 255.0
    return xval, yval

#train_ds = keras.utils.image_dataset_from_directory("/ntfsd/prgming/python-test/"+'rp-train', **LOADER_METADATA)

#class_names = train_ds.class_names
class_names = ['rock', 'paper']

def resolve_name(pred):
    pval = pred.item()
    if pval < 0.5:
        return class_names[0]
    else:
        return class_names[1]
    
def get_img_prediction(rgba_data, width, height):
    # Convert RGBA byte array to numpy array and reshape it (assuming 4 channels for RGBA)
    rgba_array = numpy.frombuffer(rgba_data, dtype=numpy.uint8).reshape((1, height, width, 4))
    # Extract RGB values by removing the Alpha channel
    rgb_array = rgba_array[:, :, :, :3]

    # Normalize the RGB values to the range [0, 1]
    rgb_normalized = rgb_array.astype(numpy.float32) / 255.0

    # Now you have an RGB image as a normalized float32 array
    # You can pass this to TensorFlow
    input_tensor = tflow.convert_to_tensor(rgb_normalized)

    # Check the shape and type of the tensor
    print(input_tensor.shape, input_tensor.dtype)

    # Use TensorFlow's image resizing function
    resized_tensor = tflow.image.resize(input_tensor, [TGT_IMG_SIZE[1], TGT_IMG_SIZE[0]])
    print(resized_tensor.shape, resized_tensor.dtype)
    return resolve_name(model.predict(resized_tensor))


HOST = "127.0.0.1"  # Standard loopback interface address (localhost)
PORT = 42024  # Port to listen on (non-privileged ports are > 1023)

# 1. Retrieve the port number passed from the Go process
if len(sys.argv) != 2:
    print("Usage: python3 python_script.py <port>")
    sys.exit(1)

port = int(sys.argv[1])

print(f"Going to connect to port on localhost:{port}")

# 2. Connect to the Go server on the provided port
conn = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
conn.connect(('localhost', port))  # Connect to the Go server

print(f"Connected to Go server on port {port}")

#with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
#print(f"Going to bind it")
#s.bind((HOST, PORT))
#s.listen()
#conn, addr = s.accept()
#print(f"Going to start it")
with conn:
    while True:
        #while True:
        wid = conn.recv(8)
        hei = conn.recv(8)
        if (not wid) or (not hei):
           break
        wid = int.from_bytes(wid, byteorder='little', signed=False)
        hei = int.from_bytes(hei, byteorder='little', signed=False)
        tots = wid * hei * 4
        print(f"Wid = {wid}, hei = {hei} tots = {tots}")
        lengot = 0
        img = b''
        while lengot < tots:
            recvd = conn.recv(tots-lengot)
            img = img + recvd
            lengot += len(recvd)
        print(f"Img size/len = {len(img)}")
        if img:
            # predict something
            prediction = bytes(get_img_prediction(img, wid, hei), 'utf-8')
            prediction = (len(prediction)).to_bytes(8, byteorder='little') + prediction
            # prediction =(11).to_bytes(8, byteorder='little') + b"HAHA Fucker"
            conn.sendall(prediction)
