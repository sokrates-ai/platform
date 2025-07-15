# SLURM Locust Load Testing

This project provides a complete setup for running distributed Locust load testing using SLURM job scheduler. It automatically spawns worker processes across cluster nodes and connects them to a central Locust master process.

## Features

- 🚀 **Automated SLURM Integration**: Automatically submit and manage worker jobs
- 📊 **Distributed Load Testing**: Scale across multiple cluster nodes
- 🔧 **Easy Configuration**: Simple configuration files and command-line options
- 📈 **Real-time Monitoring**: Monitor worker status and logs
- 🛠 **Utility Scripts**: Convenient shell scripts for common operations

## Quick Start

### 1. Install Dependencies

```bash
# Install using uv (recommended)
uv sync

# Or install manually
pip install locust
```

### 2. Configure SLURM Settings

Edit `slurm_config.py` to match your cluster configuration:

```python
@dataclass
class SlurmConfig:
    # SLURM job settings
    time_limit: str = "02:00:00"  # Adjust for your needs
    cpus_per_task: int = 1
    memory: str = "2G"
    partition: str = "cpu"        # Change to your partition name
    
    # Worker settings
    num_workers: int = 4
    master_host: str = "localhost"
    master_port: int = 5557
```

### 3. Start Load Testing

#### Option A: Using the Utility Script (Recommended)

```bash
# Start everything at once
./loadtest.sh full-start --workers 8 --partition gpu

# Or step by step
./loadtest.sh start-master
./loadtest.sh start-workers --workers 4
./loadtest.sh monitor
```

#### Option B: Using Python directly

```bash
# Terminal 1: Start Locust master
uv run locust --master --web-host=0.0.0.0

# Terminal 2: Start SLURM workers
python main.py start --workers 4

# Terminal 3: Monitor workers
python main.py monitor
```

### 4. Access Web UI

Open http://localhost:8089 in your browser to configure and start your load test.

### 5. Stop Testing

```bash
./loadtest.sh stop-workers
# Or manually: python main.py stop
```

## Commands Reference

### Python CLI (`main.py`)

```bash
# Start workers
python main.py start [--workers N] [--partition NAME] [--master-host HOST]

# Stop all workers
python main.py stop

# Check worker status
python main.py status

# Monitor workers continuously
python main.py monitor

# View worker logs
python main.py logs [--worker-id ID] [--lines N]
```

### Shell Utility (`loadtest.sh`)

```bash
# Start master only
./loadtest.sh start-master

# Start workers only
./loadtest.sh start-workers -w 8 -p gpu

# Start everything
./loadtest.sh full-start -w 4

# Monitor and manage
./loadtest.sh status
./loadtest.sh monitor
./loadtest.sh logs --worker-id 0

# Cleanup
./loadtest.sh cleanup
```

## Configuration

### SLURM Configuration (`slurm_config.py`)

| Parameter | Description | Default |
|-----------|-------------|---------|
| `time_limit` | Job time limit | "02:00:00" |
| `cpus_per_task` | CPUs per worker | 1 |
| `memory` | Memory per worker | "2G" |
| `partition` | SLURM partition | "cpu" |
| `num_workers` | Number of workers | 4 |
| `master_host` | Master host address | "localhost" |
| `master_port` | Master port | 5557 |

### Environment Variables

You can also configure via environment variables:

```bash
export SLURM_PARTITION=gpu
export LOCUST_MASTER_HOST=192.168.1.100
export LOCUST_WORKERS=8
```

## File Structure

```
load_testing/
├── main.py                    # Main CLI interface
├── locustfile.py              # Locust test definition
├── slurm_config.py            # Configuration settings
├── slurm_worker_manager.py    # SLURM worker management
├── slurm_worker_template.sh   # SLURM job script template
├── loadtest.sh               # Utility shell script
├── logs/                     # Log files directory
└── README.md                 # This file
```

## Troubleshooting

### Common Issues

1. **Workers not connecting to master**
   - Check that master host/port are correct
   - Verify network connectivity between nodes
   - Check firewall settings

2. **SLURM jobs failing**
   - Verify partition name is correct
   - Check resource requirements (memory, CPUs)
   - Review SLURM logs: `./loadtest.sh logs`

3. **Permission denied errors**
   - Ensure scripts are executable: `chmod +x loadtest.sh`
   - Check file permissions in shared directories

### Debug Commands

```bash
# Check SLURM queue
squeue -u $USER

# View detailed job info
scontrol show job JOBID

# Check node availability
sinfo

# View worker logs
./loadtest.sh logs --worker-id 0 --lines 50
```

## Advanced Usage

### Custom Locust Files

Modify `locustfile.py` or specify a different file:

```bash
python main.py start --locustfile my_custom_test.py
```

### Different Cluster Configurations

```bash
# High-memory workers
./loadtest.sh start-workers -w 4 -m 8G -t 04:00:00

# GPU partition
./loadtest.sh start-workers -p gpu -w 2

# Different master host
python main.py start --master-host 192.168.1.100 --master-port 5557
```

### Scaling Considerations

- **Network**: Ensure adequate network bandwidth between master and workers
- **Resources**: Monitor CPU and memory usage on master node
- **SLURM Limits**: Check partition limits and quotas
- **Test Target**: Ensure target system can handle the load

## Monitoring

The system provides several monitoring options:

1. **Real-time Status**: `./loadtest.sh status`
2. **Continuous Monitoring**: `./loadtest.sh monitor`
3. **Log Files**: Individual worker logs in `logs/` directory
4. **SLURM Commands**: Standard SLURM monitoring (`squeue`, `sacct`)
5. **Locust Web UI**: http://localhost:8089

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the same license as the parent platform project.