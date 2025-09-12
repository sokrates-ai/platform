 curl -X POST "http://localhost:1338/api/v1/trail/ws_record_solution" \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": 1,
    "activity_uuid": "activity_19515db0-b10c-4e5f-b1c0-2f51e1d4a6a2",
    "user_uuid": "user_c61698b5-6d83-42a2-9dad-92567ba8615a",
    "correct": true
  }'
