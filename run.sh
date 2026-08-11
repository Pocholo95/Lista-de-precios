#!/bin/bash

# Guardar la ruta actual
DIR=$(dirname "$(realpath "$0")")

# === Limitar número de hilos para ONNX, OpenBLAS, etc. ===
export OMP_NUM_THREADS=1
export OPENBLAS_NUM_THREADS=1
export NUMEXPR_NUM_THREADS=1
export MKL_NUM_THREADS=1
export VECLIB_MAXIMUM_THREADS=1

# Evitar detección de GPU (que da warnings en contenedores)
export CUDA_VISIBLE_DEVICES=""

# Activar el entorno virtual
source "$DIR/venv/bin/activate"

# Ejecutar el archivo app.py
python3 "$DIR/app.py"
