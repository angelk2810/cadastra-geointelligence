import sys
import torch
import torchvision
import transformers
from transformers import SegformerImageProcessor

print("Python executable:", sys.executable)
print("torch:", torch.__version__, torch.__file__)
print("torchvision:", torchvision.__version__, torchvision.__file__)
print("transformers:", transformers.__version__, transformers.__file__)
print("SegformerImageProcessor import: OK")
