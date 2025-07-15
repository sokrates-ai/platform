# Example configuration for SLURM Locust Load Testing
# Copy this file to slurm_config_custom.py and modify as needed

from slurm_config import SlurmConfig

# Example configuration for a GPU cluster
GPU_CLUSTER_CONFIG = SlurmConfig(
    # SLURM settings
    time_limit="04:00:00",      # 4 hours
    cpus_per_task=2,            # 2 CPUs per worker
    memory="4G",                # 4GB memory per worker
    partition="gpu",            # GPU partition
    
    # Locust settings
    num_workers=8,              # 8 workers
    master_host="cx01.hpc.sci.hpi.de",    # Master on login node
    master_port=5557,           # Default Locust port
    
    # Logging
    loglevel="INFO"
)

# Example configuration for CPU cluster with more workers
CPU_CLUSTER_CONFIG = SlurmConfig(
    # SLURM settings
    time_limit="02:00:00",      # 2 hours
    cpus_per_task=1,            # 1 CPU per worker
    memory="2G",                # 2GB memory per worker
    partition="cpu",            # CPU partition
    
    # Locust settings
    num_workers=16,             # 16 workers for higher load
    master_host="192.168.1.10", # Remote master
    master_port=5557,
    
    # Logging
    loglevel="WARNING"          # Less verbose logging
)

# Example configuration for development/testing
DEV_CONFIG = SlurmConfig(
    # SLURM settings
    time_limit="00:30:00",      # 30 minutes
    cpus_per_task=1,
    memory="1G",                # Minimal resources
    partition="debug",          # Debug/development partition
    
    # Locust settings
    num_workers=2,              # Just 2 workers for testing
    master_host="localhost",
    master_port=5557,
    
    # Logging
    loglevel="DEBUG"            # Verbose logging for debugging
)
