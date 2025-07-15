#!/bin/bash
#SBATCH --job-name=locust-worker-{worker_id}
#SBATCH --output=logs/worker_{worker_id}_%j.out
#SBATCH --error=logs/worker_{worker_id}_%j.err
#SBATCH --time={time_limit}
#SBATCH --cpus-per-task={cpus}
#SBATCH --mem={memory}
#SBATCH --partition={partition}
#SBATCH --account={account}

# Load any required modules
# module load python/3.12  # Uncomment if needed

# Set up environment
export PYTHONPATH=$PYTHONPATH:{project_root}
cd {project_root}

# Activate virtual environment if needed
# source venv/bin/activate  # Uncomment if using venv

# Install dependencies using uv
if command -v uv &> /dev/null; then
    uv sync
else
    echo "Warning: uv not found, assuming dependencies are already installed"
fi

# Run the locust worker
echo "Starting Locust worker {worker_id} connecting to master at {master_host}:{master_port}"
echo "Worker starting at $(date)"

uv run locust \
    --worker \
    --master-host={master_host} \
    --master-port={master_port} \
    --locustfile={locustfile} \
    --loglevel={loglevel}

echo "Worker {worker_id} finished at $(date)"
