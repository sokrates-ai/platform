from locust import HttpUser, task, between
import random

class GoogleDeUser(HttpUser):
    wait_time = between(1, 3)  # Wait 1-3 seconds between tasks
    
    def on_start(self):
        """Called when a user starts"""
        self.host = "https://www.google.de"
    
    @task(3)
    def visit_homepage(self):
        """Visit Google.de homepage - most common action"""
        response = self.client.get("/", name="Homepage")
        if response.status_code == 200:
            print("Successfully loaded Google.de homepage")
    
    @task(2)
    def search_query(self):
        """Perform a search query"""
        search_terms = [
            "Python programming",
            "Locust load testing",
            "Software development",
            "Web development",
            "Machine learning",
            "Berlin weather"
        ]
        query = random.choice(search_terms)
        
        # Perform search
        response = self.client.get(
            "/search",
            params={"q": query},
            name="Search Query"
        )
        if response.status_code == 200:
            print(f"Search for '{query}' completed successfully")
    
    @task(1)
    def visit_images(self):
        """Visit Google Images"""
        response = self.client.get("/imghp", name="Google Images")
        if response.status_code == 200:
            print("Successfully visited Google Images")
    
    @task(1)
    def search_images(self):
        """Search for images"""
        image_queries = [
            "cats",
            "mountains",
            "technology",
            "cars",
            "nature"
        ]
        query = random.choice(image_queries)
        
        response = self.client.get(
            "/search",
            params={"q": query, "tbm": "isch"},
            name="Image Search"
        )
        if response.status_code == 200:
            print(f"Image search for '{query}' completed successfully")