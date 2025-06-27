#!/bin/bash
cd /home/kavia/workspace/code-generation/fruitslice-frenzy-114724-0f5ab87c/fruit_slice_frontend_workspace/fruit_slice_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

