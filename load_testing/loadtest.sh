#!/bin/bash

# SLURM Locust Load Testing Utility Script
# This script provides convenient commands for managing load testing

set -e

# Configuration - modify these according to your environment
DEFAULT_PARTITION="cpu"
DEFAULT_WORKERS=4
DEFAULT_TIME_LIMIT="02:00:00"
DEFAULT_MEMORY="2G"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

usage() {
    echo "SLURM Locust Load Testing Utility"
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  start-master     Start Locust master process"
    echo "  start-workers    Start SLURM worker processes"
    echo "  stop-workers     Stop all SLURM workers"
    echo "  status           Show worker status"
    echo "  monitor          Monitor workers continuously"
    echo "  logs             Show worker logs"
    echo "  full-start       Start master and workers together"
    echo "  cleanup          Clean up log files and temporary files"
    echo "  help             Show this help message"
    echo ""
    echo "Options:"
    echo "  -w, --workers NUM        Number of workers (default: $DEFAULT_WORKERS)"
    echo "  -p, --partition NAME     SLURM partition (default: $DEFAULT_PARTITION)"
    echo "  -t, --time LIMIT         Time limit (default: $DEFAULT_TIME_LIMIT)"
    echo "  -m, --memory SIZE        Memory per worker (default: $DEFAULT_MEMORY)"
    echo "  -h, --host HOST          Master host (default: localhost)"
    echo "  --port PORT              Master port (default: 5557)"
    echo ""
    echo "Examples:"
    echo "  $0 start-master                    # Start Locust master"
    echo "  $0 start-workers -w 8              # Start 8 workers"
    echo "  $0 full-start -w 4 -p gpu          # Start master + 4 workers on GPU partition"
    echo "  $0 logs --worker-id 0              # Show logs for worker 0"
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_dependencies() {
    # Check if required commands are available
    local missing_deps=()
    
    if ! command -v uv &> /dev/null; then
        missing_deps+=("uv")
    fi
    
    if ! command -v sbatch &> /dev/null; then
        missing_deps+=("slurm (sbatch)")
    fi
    
    if ! command -v squeue &> /dev/null; then
        missing_deps+=("slurm (squeue)")
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        log_error "Missing dependencies: ${missing_deps[*]}"
        echo "Please install the missing dependencies and try again."
        exit 1
    fi
}

start_master() {
    log_info "Starting Locust master process..."
    
    # Check if master is already running
    if pgrep -f "locust.*--master" > /dev/null; then
        log_warning "Locust master appears to already be running"
        echo "Use 'pkill -f \"locust.*--master\"' to stop it first if needed"
        return 1
    fi
    
    # Start master in background
    nohup uv run locust --master --web-host=0.0.0.0 --master-bind-host=0.0.0.0 --locustfile=locustfile.py > logs/master.log 2>&1 &
    local master_pid=$!
    
    echo $master_pid > logs/master.pid
    
    log_success "Locust master started (PID: $master_pid)"
    log_info "Web UI: http://localhost:8089"
    log_info "Master logs: logs/master.log"
    
    # Wait a moment and check if it's still running
    sleep 2
    if ! kill -0 $master_pid 2>/dev/null; then
        log_error "Master process seems to have died. Check logs/master.log"
        return 1
    fi
    
    return 0
}

stop_master() {
    log_info "Stopping Locust master..."
    
    if [ -f logs/master.pid ]; then
        local master_pid=$(cat logs/master.pid)
        if kill -0 $master_pid 2>/dev/null; then
            kill $master_pid
            log_success "Master process stopped"
        else
            log_warning "Master process was not running"
        fi
        rm -f logs/master.pid
    else
        # Try to find and kill any locust master process
        pkill -f "locust.*--master" || log_warning "No master process found"
    fi
}

cleanup() {
    log_info "Cleaning up temporary files..."
    
    # Remove temporary worker scripts
    rm -f worker_*.sh
    
    # Ask about log files
    if [ -d logs ] && [ "$(ls -A logs)" ]; then
        echo -n "Remove log files? (y/N): "
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            rm -rf logs/*
            log_success "Log files removed"
        fi
    fi
    
    log_success "Cleanup completed"
}

# Parse command line arguments
COMMAND=""
WORKERS=$DEFAULT_WORKERS
PARTITION=$DEFAULT_PARTITION
TIME_LIMIT=$DEFAULT_TIME_LIMIT
MEMORY=$DEFAULT_MEMORY
HOST="cx01.hpc.sci.hpi.de"
PORT="5557"
EXTRA_ARGS=()

while [[ $# -gt 0 ]]; do
    case $1 in
        start-master|start-workers|stop-workers|status|monitor|logs|full-start|cleanup|help)
            COMMAND="$1"
            shift
            ;;
        -w|--workers)
            WORKERS="$2"
            shift 2
            ;;
        -p|--partition)
            PARTITION="$2"
            shift 2
            ;;
        -t|--time)
            TIME_LIMIT="$2"
            shift 2
            ;;
        -m|--memory)
            MEMORY="$2"
            shift 2
            ;;
        -h|--host)
            HOST="$2"
            shift 2
            ;;
        --port)
            PORT="$2"
            shift 2
            ;;
        --worker-id)
            EXTRA_ARGS+=("--worker-id" "$2")
            shift 2
            ;;
        --lines)
            EXTRA_ARGS+=("--lines" "$2")
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Set default command if none provided
if [ -z "$COMMAND" ]; then
    usage
    exit 0
fi

# Ensure logs directory exists
mkdir -p logs

# Check dependencies
check_dependencies

# Execute command
case $COMMAND in
    start-master)
        start_master
        ;;
    start-workers)
        log_info "Starting $WORKERS SLURM workers..."
        python main.py start --workers "$WORKERS" --partition "$PARTITION" \
            --time-limit "$TIME_LIMIT" --memory "$MEMORY" \
            --master-host "$HOST" --master-port "$PORT"
        ;;
    stop-workers)
        python main.py stop
        ;;
    status)
        python main.py status
        ;;
    monitor)
        python main.py monitor
        ;;
    logs)
        python main.py logs "${EXTRA_ARGS[@]}"
        ;;
    full-start)
        log_info "Starting full load testing environment..."
        
        # Start master
        if start_master; then
            log_info "Waiting for master to initialize..."
            sleep 3
            
            # Start workers
            log_info "Starting $WORKERS SLURM workers..."
            if python main.py start --workers "$WORKERS" --partition "$PARTITION" \
                --time-limit "$TIME_LIMIT" --memory "$MEMORY" \
                --master-host "$HOST" --master-port "$PORT"; then
                
                log_success "Load testing environment started successfully!"
                echo ""
                echo "Next steps:"
                echo "1. Open web UI: http://localhost:8089"
                echo "2. Configure your test parameters"
                echo "3. Start the test"
                echo "4. Monitor with: $0 monitor"
                echo "5. Stop with: $0 stop-workers && pkill -f 'locust.*--master'"
            else
                log_error "Failed to start workers"
                stop_master
                exit 1
            fi
        else
            log_error "Failed to start master"
            exit 1
        fi
        ;;
    cleanup)
        cleanup
        ;;
    help)
        usage
        ;;
    *)
        echo "Unknown command: $COMMAND"
        usage
        exit 1
        ;;
esac
