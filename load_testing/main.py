import argparse
import sys
import time
from slurm_worker_manager import SlurmWorkerManager
from slurm_config import SlurmConfig, DEFAULT_SLURM_CONFIG


def main():
    parser = argparse.ArgumentParser(description="Load Testing with SLURM Workers")
    parser.add_argument('action', choices=['start', 'stop', 'status', 'monitor', 'logs'], 
                       help="Action to perform")
    parser.add_argument('--workers', type=int, default=DEFAULT_SLURM_CONFIG.num_workers,
                       help="Number of workers to start")
    parser.add_argument('--master-host', default=DEFAULT_SLURM_CONFIG.master_host,
                       help="Locust master host")
    parser.add_argument('--master-port', type=int, default=DEFAULT_SLURM_CONFIG.master_port,
                       help="Locust master port")
    parser.add_argument('--partition', default=DEFAULT_SLURM_CONFIG.partition,
                       help="SLURM partition to use")
    parser.add_argument('--time-limit', default=DEFAULT_SLURM_CONFIG.time_limit,
                       help="SLURM job time limit")
    parser.add_argument('--memory', default=DEFAULT_SLURM_CONFIG.memory,
                       help="Memory per worker")
    parser.add_argument('--cpus', type=int, default=DEFAULT_SLURM_CONFIG.cpus_per_task,
                       help="CPUs per worker")
    parser.add_argument('--worker-id', type=int,
                       help="Specific worker ID for logs command")
    parser.add_argument('--lines', type=int, default=20,
                       help="Number of log lines to show")
    
    args = parser.parse_args()
    
    # Create custom config based on arguments
    config = SlurmConfig(
        num_workers=args.workers,
        master_host=args.master_host,
        master_port=args.master_port,
        partition=args.partition,
        time_limit=args.time_limit,
        memory=args.memory,
        cpus_per_task=args.cpus
    )
    
    manager = SlurmWorkerManager(config)
    
    try:
        if args.action == 'start':
            print(f"Starting {config.num_workers} SLURM workers...")
            print(f"Master: {config.master_host}:{config.master_port}")
            print(f"Partition: {config.partition}")
            print(f"Resources: {config.cpus_per_task} CPUs, {config.memory} memory")
            print(f"Time limit: {config.time_limit}")
            print()
            
            started = manager.start_all_workers()
            if started > 0:
                print(f"\n{started} workers submitted to SLURM")
                print("Use 'python main.py status' to check worker status")
                print("Use 'python main.py monitor' to continuously monitor workers")
                print("Use 'python main.py stop' to stop all workers")
                
                # Wait for workers to start
                if manager.wait_for_workers(timeout=180):
                    print("\nAll workers are now running and ready for load testing!")
                else:
                    print("\nSome workers may still be starting up. Check status manually.")
            else:
                print("Failed to start any workers")
                return 1
                
        elif args.action == 'stop':
            stopped = manager.stop_all_workers()
            if stopped > 0:
                print(f"Successfully stopped {stopped} workers")
            else:
                print("No workers were running")
                
        elif args.action == 'status':
            status = manager.get_worker_status()
            if status:
                print("Worker Status:")
                print("-" * 50)
                for worker_id, info in status.items():
                    print(f"Worker {worker_id:2d}: {info['state']:10s} (Job: {info['job_id']})")
                    if info['reason']:
                        print(f"             Reason: {info['reason']}")
            else:
                print("No workers currently running")
                
        elif args.action == 'monitor':
            manager.monitor_workers()
            
        elif args.action == 'logs':
            manager.show_logs(args.worker_id, args.lines)
            
    except KeyboardInterrupt:
        print("\nOperation cancelled by user")
        return 1
    except Exception as e:
        print(f"Error: {e}")
        return 1
    
    return 0


def start_locust_master():
    """Helper function to start Locust master process"""
    import subprocess
    import os
    
    print("Starting Locust master process...")
    cmd = [
        "uv", "run", "locust",
        "--master",
        "--web-host=0.0.0.0",
        "--master-bind-host=0.0.0.0",
        "--locustfile=locustfile.py"
    ]
    
    try:
        # Start master in background
        process = subprocess.Popen(cmd, cwd=os.path.dirname(__file__))
        print(f"Locust master started with PID: {process.pid}")
        print("Web UI available at: http://localhost:8089")
        print("Workers will connect to: localhost:5557")
        return process
    except Exception as e:
        print(f"Failed to start Locust master: {e}")
        return None


if __name__ == "__main__":
    # If no arguments provided, show help and start interactive mode
    if len(sys.argv) == 1:
        print("SLURM Locust Load Testing Manager")
        print("=" * 40)
        print()
        print("Quick start:")
        print("1. Start Locust master: uv run locust --master --web-host=0.0.0.0")
        print("2. Start SLURM workers: python main.py start")
        print("3. Monitor workers: python main.py monitor")
        print("4. Stop workers: python main.py stop")
        print()
        print("Available commands:")
        print("  start   - Start SLURM worker processes")
        print("  stop    - Stop all SLURM workers")
        print("  status  - Show current worker status")
        print("  monitor - Continuously monitor workers")
        print("  logs    - Show worker logs")
        print()
        print("For detailed help: python main.py --help")
        print()
        
        # Ask if user wants to start master
        try:
            choice = input("Would you like to start the Locust master now? (y/N): ").strip().lower()
            if choice in ['y', 'yes']:
                master_process = start_locust_master()
                if master_process:
                    time.sleep(2)  # Give master time to start
                    print("\nNow you can start workers with: python main.py start")
        except KeyboardInterrupt:
            print("\nBye!")
        
        sys.exit(0)
    
    exit_code = main()
    sys.exit(exit_code)
