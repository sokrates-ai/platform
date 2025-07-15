import os
import subprocess
import time
import signal
import sys
from pathlib import Path
from typing import List, Dict, Optional
from slurm_config import SlurmConfig, DEFAULT_SLURM_CONFIG


class SlurmWorkerManager:
    """Manages SLURM worker processes for Locust load testing"""
    
    def __init__(self, config: SlurmConfig = None):
        self.config = config or DEFAULT_SLURM_CONFIG
        self.worker_jobs: Dict[int, str] = {}  # worker_id -> job_id
        self.is_running = False
        
        # Create logs directory
        log_dir = Path(self.config.project_root) / self.config.log_dir
        log_dir.mkdir(exist_ok=True)
        
        # Setup signal handlers for cleanup
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
    
    def _signal_handler(self, signum, frame):
        """Handle shutdown signals"""
        print(f"\nReceived signal {signum}, shutting down workers...")
        self.stop_all_workers()
        sys.exit(0)
    
    def _create_worker_script(self, worker_id: int) -> str:
        """Create a SLURM script for a specific worker"""
        template_path = Path(self.config.project_root) / self.config.slurm_template
        
        with open(template_path, 'r') as f:
            template = f.read()
        
        # Replace placeholders
        script_content = template.format(
            worker_id=worker_id,
            time_limit=self.config.time_limit,
            cpus=self.config.cpus_per_task,
            memory=self.config.memory,
            partition=self.config.partition,
            project_root=self.config.project_root,
            master_host=self.config.master_host,
            master_port=self.config.master_port,
            locustfile=self.config.locustfile,
            loglevel=self.config.loglevel,
            account=self.config.account,
        )
        
        # Write script to temporary file
        script_path = Path(self.config.project_root) / f"worker_{worker_id}.sh"
        with open(script_path, 'w') as f:
            f.write(script_content)
        
        # Make executable
        os.chmod(script_path, 0o755)
        
        return str(script_path)
    
    def start_worker(self, worker_id: int) -> Optional[str]:
        """Start a single SLURM worker"""
        try:
            script_path = self._create_worker_script(worker_id)
            
            # Submit SLURM job
            cmd = ["sbatch", script_path]
            result = subprocess.run(cmd, capture_output=True, text=True, cwd=self.config.project_root)
            
            if result.returncode == 0:
                # Extract job ID from output (e.g., "Submitted batch job 12345")
                job_id = result.stdout.strip().split()[-1]
                self.worker_jobs[worker_id] = job_id
                print(f"Started worker {worker_id} with SLURM job ID: {job_id}")
                
                # Clean up script file
                os.remove(script_path)
                
                return job_id
            else:
                print(f"Failed to start worker {worker_id}: {result.stderr}")
                return None
                
        except Exception as e:
            print(f"Error starting worker {worker_id}: {e}")
            return None
    
    def stop_worker(self, worker_id: int) -> bool:
        """Stop a specific worker"""
        if worker_id not in self.worker_jobs:
            print(f"Worker {worker_id} not found")
            return False
        
        job_id = self.worker_jobs[worker_id]
        try:
            result = subprocess.run(["scancel", job_id], capture_output=True, text=True)
            if result.returncode == 0:
                print(f"Stopped worker {worker_id} (job ID: {job_id})")
                del self.worker_jobs[worker_id]
                return True
            else:
                print(f"Failed to stop worker {worker_id}: {result.stderr}")
                return False
        except Exception as e:
            print(f"Error stopping worker {worker_id}: {e}")
            return False
    
    def start_all_workers(self) -> int:
        """Start all configured workers"""
        print(f"Starting {self.config.num_workers} SLURM workers...")
        
        started_count = 0
        for worker_id in range(self.config.num_workers):
            if self.start_worker(worker_id):
                started_count += 1
                # Small delay between submissions
                time.sleep(1)
        
        self.is_running = True
        print(f"Successfully started {started_count}/{self.config.num_workers} workers")
        return started_count
    
    def stop_all_workers(self) -> int:
        """Stop all running workers"""
        if not self.worker_jobs:
            print("No workers running")
            return 0
        
        print("Stopping all workers...")
        stopped_count = 0
        
        # Stop all workers
        worker_ids = list(self.worker_jobs.keys())
        for worker_id in worker_ids:
            if self.stop_worker(worker_id):
                stopped_count += 1
        
        self.is_running = False
        print(f"Stopped {stopped_count} workers")
        return stopped_count
    
    def get_worker_status(self) -> Dict[int, Dict]:
        """Get status of all workers"""
        if not self.worker_jobs:
            return {}
        
        status = {}
        
        # Get job status from SLURM
        job_ids = list(self.worker_jobs.values())
        try:
            cmd = ["squeue", "-j", ",".join(job_ids), "--format=%i,%T,%R", "--noheader"]
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                # Parse output
                for line in result.stdout.strip().split('\n'):
                    if line:
                        parts = line.split(',')
                        if len(parts) >= 2:
                            job_id = parts[0]
                            state = parts[1]
                            reason = parts[2] if len(parts) > 2 else ""
                            
                            # Find worker_id for this job_id
                            for worker_id, j_id in self.worker_jobs.items():
                                if j_id == job_id:
                                    status[worker_id] = {
                                        'job_id': job_id,
                                        'state': state,
                                        'reason': reason
                                    }
                                    break
        except Exception as e:
            print(f"Error getting worker status: {e}")
        
        return status
    
    def wait_for_workers(self, timeout: int = 300) -> bool:
        """Wait for workers to start and be in running state"""
        print("Waiting for workers to start...")
        
        start_time = time.time()
        while time.time() - start_time < timeout:
            status = self.get_worker_status()
            
            if not status:
                time.sleep(5)
                continue
            
            running_workers = sum(1 for s in status.values() if s['state'] == 'RUNNING')
            total_workers = len(self.worker_jobs)
            
            print(f"Workers running: {running_workers}/{total_workers}")
            
            if running_workers == total_workers:
                print("All workers are now running!")
                return True
            
            time.sleep(10)
        
        print(f"Timeout waiting for workers to start after {timeout} seconds")
        return False
    
    def monitor_workers(self, check_interval: int = 30):
        """Monitor worker status continuously"""
        print("Monitoring workers... Press Ctrl+C to stop")
        
        try:
            while self.is_running:
                status = self.get_worker_status()
                
                if status:
                    print(f"\n--- Worker Status at {time.strftime('%Y-%m-%d %H:%M:%S')} ---")
                    for worker_id, info in status.items():
                        print(f"Worker {worker_id}: {info['state']} (Job: {info['job_id']})")
                else:
                    print("No workers running")
                    break
                
                time.sleep(check_interval)
                
        except KeyboardInterrupt:
            print("\nMonitoring stopped")
    
    def show_logs(self, worker_id: Optional[int] = None, lines: int = 20):
        """Show recent logs for workers"""
        log_dir = Path(self.config.project_root) / self.config.log_dir
        
        if worker_id is not None:
            # Show logs for specific worker
            pattern = f"worker_{worker_id}_*.out"
            log_files = list(log_dir.glob(pattern))
            
            if log_files:
                latest_log = max(log_files, key=os.path.getctime)
                print(f"\n--- Last {lines} lines from worker {worker_id} log ---")
                subprocess.run(["tail", "-n", str(lines), str(latest_log)])
            else:
                print(f"No log files found for worker {worker_id}")
        else:
            # Show logs for all workers
            for w_id in self.worker_jobs.keys():
                self.show_logs(w_id, lines)
                print()  # Empty line between workers
