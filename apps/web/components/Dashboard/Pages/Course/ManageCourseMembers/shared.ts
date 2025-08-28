
export interface ApiStudent {
    id: number,
    user_uuid: string,
    first_name: string,
    last_name: string,
    email: string,
    avatar_image: string, // URL of the avatar image
    // age: number,
    // grade: string,
    // avatar: string,
    // exercises: number,
    // homework: number,
    // satisfaction: number,
    // performance: number
    // performanceHistory: PerformancePoint[],
    // exerciseHistory: ExerciseLog[],
}

// [
// 	{
// 		"username": "admin",
// 		"first_name": "",
// 		"last_name": "",
// 		"email": "admin@school.dev",
// 		"avatar_image": "user_9df94982-d2dd-414a-b44b-38754466d49a_avatar_ea1370f7-19c2-401d-bef1-8920f4b90e6d.png",
// 		"bio": "",
// 		"id": 1,
// 		"user_uuid": "user_9df94982-d2dd-414a-b44b-38754466d49a"
// 	},
// 	{
// 		"username": "admin2",
// 		"first_name": "",
// 		"last_name": "",
// 		"email": "admin2@school.dev",
// 		"avatar_image": "user_fc8c8476-3718-4d5a-9228-79c266b3dda0_avatar_a729d1d4-483a-4fe3-8af7-9fb54d9af4a1.png",
// 		"bio": "Admin2",
// 		"id": 2,
// 		"user_uuid": "user_fc8c8476-3718-4d5a-9228-79c266b3dda0"
// 	}
// ]
