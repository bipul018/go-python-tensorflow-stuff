import stsae_gcn
import logpy
import torch
import numpy
import os

# Loading the model code 
checkpoint_path = os.path.join(stsae_gcn.SAVE_PATH, 'best_model.pth')
in_channels = 3
hidden_channels= 64
num_classes= stsae_gcn.NUM_CLASSES
num_frames= 20
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

model = stsae_gcn.STSAE_GCN(in_channels, hidden_channels, num_classes, num_frames)
checkpoint = torch.load(checkpoint_path, weights_only = False,
                        map_location = device)
model.load_state_dict(checkpoint['model_state_dict'])

if model is None:
    logpy.err(f"Did not find any model to load from checkpoint")
else:
    logpy.log(f"Found the model")

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model = model.to(device)
model.eval()

# Load Images from a video file here
import cv2
import mediapipe as mpipe

mp_pose = mpipe.solutions.pose
mp_drawing = mpipe.solutions.drawing_utils

class FrameBuffer():
    def __init__(self, cxt_size, shape = (33,3)): #landmark_count=33, dims=3):
        self.cxt_size = cxt_size
        self.tensor = torch.zeros([cxt_size] + list(shape))#landmark_count, dims])
        self.last_pred = ""
        self.last_prob = 0

    def from_other(self, another_buffer, cxt_size):
        self.tensor = torch.zeros([cxt_size] + list(another_buffer.shape[1:]))
        self.last_pred = another_sampler.last_pred
        self.last_prob = another_sampler.last_prob
        self.cxt_size = cxt_size
        mincxt = min(cxt_size, another_sampler.cxt_size)
        self.tensor[:min_cxt] = another_sampler.tensor[:min_cxt]
        
    # 'landmarks' must be a tensor
    def update(self, landmarks):
        self.tensor = self.tensor.roll(shifts = -1, dims = 0)
        # make landmarks reshape reshuffle
        # tmp = landmarks.permute((1,0))
        self.tensor[-1] = landmarks
        #self.tensor[-1] = tmp
        
        with torch.no_grad():
            inputs = self.tensor.permute((2,0,1)).unsqueeze(0)
            outputs = model(inputs)
            maxval,predictions = torch.max(torch.softmax(outputs,1), 1)
            pose_name = stsae_gcn.subset_of_poses[predictions]
            self.last_pred = pose_name
            self.last_prob = maxval.item() * 100
        return (self.last_pred, self.last_prob)
    def get_pred_str(self):
        return f'{self.last_pred}({self.last_prob:.1f}%)'

sampler = FrameBuffer(cxt_size = 20)
sampler.last_pred = "No prediction"


import mediapipe as mpipe

BaseOptions = mpipe.tasks.BaseOptions
PoseLandmarker = mpipe.tasks.vision.PoseLandmarker
PoseLandmarkerOptions = mpipe.tasks.vision.PoseLandmarkerOptions
VisionRunningMode = mpipe.tasks.vision.RunningMode

options = PoseLandmarkerOptions(
    base_options=BaseOptions(model_asset_path='pose_landmarker_lite.task'),
    running_mode=VisionRunningMode.VIDEO)

# STEP 2: Create an PoseLandmarker object.
detector = PoseLandmarker.create_from_options(options)

def unnormalize(pt, wid, hei):
    x = (1-pt[0]) * wid
    y = pt[1] * hei
    # x = (x + 1) * 0.5 * wid
    # y = (y + 1) * 0.5 * hei
    if (x >= 0) and (y >= 0) and (x < wid) and (y < hei):
        return (int(x) , int(y))
    return None
# TODO:: Make this ts more accurate
ts = 0
def run_on_image(rgb_image):
    global ts
    if len(rgb_image.shape) == 4:
        rgb_image = rgb_image[0]
    rgb_image = numpy.ascontiguousarray(rgb_image)
    bgr_image = mpipe.Image(image_format=mpipe.ImageFormat.SRGB, data=cv2.flip(rgb_image,1))
    results = detector.detect_for_video(bgr_image, ts)
    ts += 100 # assumes ~ 10fps
    if results.pose_landmarks:
        pts = []
        for pt in results.pose_world_landmarks[0]:
            pts.append([pt.x, pt.y, pt.z])
        pts = torch.tensor(pts)

        pred_name, pred_prob = sampler.update(pts)

        pts = []
        for pt in results.pose_landmarks[0]:
            pts.append([pt.x, pt.y, pt.z])

        # loop over all the landmark indices pairs and draw lines
        for pair in mpipe.solutions.pose.POSE_CONNECTIONS:
            pt1 = unnormalize(pts[pair[0]], rgb_image.shape[1], rgb_image.shape[0])
            pt2 = unnormalize(pts[pair[1]], rgb_image.shape[1], rgb_image.shape[0])
            if (pt1 is not None) and (pt2 is not None):
                cv2.line(rgb_image, pt1, pt2, (0, 0, 255), thickness=1)

            

        rgb_image = cv2.cvtColor(rgb_image, cv2.COLOR_RGB2RGBA)
        # logpy.log(f"The result image is of type {type(rgb_image)} and data type of {rgb_image.dtype}")
        return f"{sampler.last_pred} : {sampler.last_prob:.2f}%", rgb_image
    return f"No Detection, previously:{sampler.last_pred} : {sampler.last_prob:.2f}%", None
