import requests
import sys
import json
from datetime import datetime

class BabaFaloodaAPITester:
    def __init__(self, base_url="http://localhost:8000"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    if isinstance(response_data, dict) and len(str(response_data)) < 500:
                        print(f"   Response: {response_data}")
                except:
                    pass
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text}")
                self.failed_tests.append({
                    'name': name,
                    'expected': expected_status,
                    'actual': response.status_code,
                    'endpoint': endpoint
                })

            return success, response.json() if response.content else {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({
                'name': name,
                'error': str(e),
                'endpoint': endpoint
            })
            return False, {}

    def test_menu_endpoints(self):
        """Test menu-related endpoints"""
        print("\n" + "="*50)
        print("TESTING MENU ENDPOINTS")
        print("="*50)
        
        # Test get all menu items
        success, menu_data = self.run_test(
            "Get Menu Items",
            "GET",
            "api/menu",
            200
        )
        
        if success and menu_data:
            print(f"   Found {len(menu_data)} menu items")
            if len(menu_data) >= 10:
                print("✅ Menu has expected 10+ items")
            else:
                print(f"⚠️  Expected 10+ menu items, found {len(menu_data)}")
            
            # Test get specific menu item
            if menu_data:
                first_item = menu_data[0]
                self.run_test(
                    "Get Specific Menu Item",
                    "GET",
                    f"api/menu/{first_item['id']}",
                    200
                )
        
        return success

    def test_story_endpoint(self):
        """Test story endpoint"""
        print("\n" + "="*50)
        print("TESTING STORY ENDPOINT")
        print("="*50)
        
        success, story_data = self.run_test(
            "Get Our Story",
            "GET",
            "api/story",
            200
        )
        
        if success and story_data:
            required_fields = ['title', 'content']
            for field in required_fields:
                if field in story_data and story_data[field]:
                    print(f"✅ Story has {field}")
                else:
                    print(f"⚠️  Story missing {field}")
        
        return success

    def test_auth_endpoints(self):
        """Test authentication endpoints"""
        print("\n" + "="*50)
        print("TESTING AUTH ENDPOINTS")
        print("="*50)
        
        # Test customer registration
        timestamp = datetime.now().strftime("%H%M%S")
        test_customer_email = f"testcustomer{timestamp}@test.com"
        
        success_reg, reg_data = self.run_test(
            "Customer Registration",
            "POST",
            "api/auth/register",
            200,
            data={
                "name": "Test Customer",
                "email": test_customer_email,
                "password": "Test1234",
                "phone": "1234567890"
            }
        )
        
        customer_token = None
        if success_reg and 'token' in reg_data:
            customer_token = reg_data['token']
            print("✅ Customer registration successful, token obtained")
            print(f"   Customer role: {reg_data.get('role', 'unknown')}")
            
            # Test customer login with same credentials
            success_login, login_data = self.run_test(
                "Customer Login",
                "POST",
                "api/auth/login",
                200,
                data={"email": test_customer_email, "password": "Test1234"}
            )
            
            if success_login and 'token' in login_data:
                print("✅ Customer login successful")
                print(f"   Customer role: {login_data.get('role', 'unknown')}")
        
        # Test admin login
        success_admin, admin_data = self.run_test(
            "Admin Login",
            "POST",
            "api/auth/login",
            200,
            data={"email": "admin@babafalooda.com", "password": "BabaAdmin2024!"}
        )
        
        if success_admin and 'token' in admin_data:
            self.token = admin_data['token']
            print("✅ Admin login successful, token obtained")
            print(f"   Admin role: {admin_data.get('role', 'unknown')}")
            
            # Test get current user
            self.run_test(
                "Get Current User (Admin)",
                "GET",
                "api/auth/me",
                200
            )
            
            # Test logout
            self.run_test(
                "Logout",
                "POST",
                "api/auth/logout",
                200
            )
        else:
            print("❌ Admin login failed - cannot test protected endpoints")
            return False
        
        # Test duplicate registration (should fail)
        self.run_test(
            "Duplicate Registration (Should Fail)",
            "POST",
            "api/auth/register",
            409,  # Conflict
            data={
                "name": "Test Customer 2",
                "email": test_customer_email,  # Same email
                "password": "Test1234"
            }
        )
        
        return success_reg and success_admin

    def test_order_endpoints(self):
        """Test order creation"""
        print("\n" + "="*50)
        print("TESTING ORDER ENDPOINTS")
        print("="*50)
        
        # First get menu items to create an order
        success, menu_data = self.run_test(
            "Get Menu for Order Test",
            "GET",
            "api/menu",
            200
        )
        
        if not success or not menu_data:
            print("❌ Cannot test orders without menu data")
            return False
        
        # Create test order
        test_order = {
            "items": [
                {"menu_item_id": menu_data[0]['id'], "quantity": 2}
            ],
            "customer_name": "Test Customer",
            "customer_email": "test@example.com",
            "customer_phone": "1234567890",
            "notes": "Test order"
        }
        
        success, order_data = self.run_test(
            "Create Order",
            "POST",
            "api/orders",
            200,
            data=test_order
        )
        
        if success and 'id' in order_data:
            order_id = order_data['id']
            print(f"✅ Order created with ID: {order_id}")
            
            # Test get order
            self.run_test(
                "Get Order",
                "GET",
                f"api/orders/{order_id}",
                200
            )
        
        return success

    def test_ai_endpoints(self):
        """Test AI endpoints"""
        print("\n" + "="*50)
        print("TESTING AI ENDPOINTS")
        print("="*50)
        
        # Test AI recommendations
        success1, rec_data = self.run_test(
            "AI Recommendations",
            "POST",
            "api/ai/recommend",
            200,
            data={"preferences": "I love mango desserts"}
        )
        
        if success1 and rec_data:
            if 'message' in rec_data:
                print("✅ AI recommendation has message")
            if 'recommendations' in rec_data:
                print(f"✅ AI recommendation has {len(rec_data.get('recommendations', []))} recommendations")
        
        # Test AI chat
        success2, chat_data = self.run_test(
            "AI Chat",
            "POST",
            "api/ai/chat",
            200,
            data={"message": "What's your most popular falooda?", "session_id": "test-session"}
        )
        
        if success2 and chat_data:
            if 'response' in chat_data:
                print("✅ AI chat has response")
            if 'session_id' in chat_data:
                print("✅ AI chat has session_id")
        
        return success1 and success2

    def test_admin_endpoints(self):
        """Test admin-only endpoints"""
        print("\n" + "="*50)
        print("TESTING ADMIN ENDPOINTS")
        print("="*50)
        
        if not self.token:
            print("❌ No admin token available - skipping admin tests")
            return False
        
        # Test get all orders (admin only)
        success1, orders_data = self.run_test(
            "Get All Orders (Admin)",
            "GET",
            "api/admin/orders",
            200
        )
        
        # Test order trends (admin only)
        success2, trends_data = self.run_test(
            "Get Order Trends (Admin)",
            "GET",
            "api/admin/orders/trends",
            200
        )
        
        if success2 and trends_data:
            expected_fields = ['total_orders', 'total_revenue', 'daily_revenue', 'top_items']
            for field in expected_fields:
                if field in trends_data:
                    print(f"✅ Trends data has {field}")
                else:
                    print(f"⚠️  Trends data missing {field}")
        
        return success1 and success2

    def test_checkout_endpoints(self):
        """Test checkout/payment endpoints"""
        print("\n" + "="*50)
        print("TESTING CHECKOUT ENDPOINTS")
        print("="*50)
        
        # First create an order
        success, menu_data = self.run_test(
            "Get Menu for Checkout Test",
            "GET",
            "api/menu",
            200
        )
        
        if not success or not menu_data:
            print("❌ Cannot test checkout without menu data")
            return False
        
        test_order = {
            "items": [{"menu_item_id": menu_data[0]['id'], "quantity": 1}],
            "customer_name": "Checkout Test",
            "customer_email": "checkout@test.com"
        }
        
        success, order_data = self.run_test(
            "Create Order for Checkout",
            "POST",
            "api/orders",
            200,
            data=test_order
        )
        
        if success and 'id' in order_data:
            # Test checkout session creation
            checkout_success, checkout_data = self.run_test(
                "Create Checkout Session",
                "POST",
                "api/checkout",
                200,
                data={
                    "order_id": order_data['id'],
                    "origin_url": "http://localhost:3000"
                }
            )
            
            if checkout_success and 'url' in checkout_data:
                print("✅ Checkout session created with Stripe URL")
                return True
        
        return False

    def test_favourites_endpoints(self):
        """Test favourites endpoints"""
        print("\n" + "="*50)
        print("TESTING FAVOURITES ENDPOINTS")
        print("="*50)
        
        # First register a customer for favourites testing
        timestamp = datetime.now().strftime("%H%M%S")
        test_email = f"favtest{timestamp}@test.com"
        
        success_reg, reg_data = self.run_test(
            "Register Customer for Favourites Test",
            "POST",
            "api/auth/register",
            200,
            data={
                "name": "Favourites Test User",
                "email": test_email,
                "password": "Test1234"
            }
        )
        
        if not success_reg or 'token' not in reg_data:
            print("❌ Cannot test favourites without customer registration")
            return False
        
        customer_token = reg_data['token']
        
        # Get menu items to add to favourites
        success_menu, menu_data = self.run_test(
            "Get Menu for Favourites Test",
            "GET",
            "api/menu",
            200
        )
        
        if not success_menu or not menu_data:
            print("❌ Cannot test favourites without menu data")
            return False
        
        first_item_id = menu_data[0]['id']
        
        # Test get empty favourites initially
        success_empty, empty_favs = self.run_test(
            "Get Empty Favourites",
            "GET",
            "api/favourites",
            200,
            headers={'Authorization': f'Bearer {customer_token}'}
        )
        
        if success_empty and isinstance(empty_favs, list) and len(empty_favs) == 0:
            print("✅ Empty favourites list returned correctly")
        
        # Test add to favourites
        success_add, add_response = self.run_test(
            "Add Item to Favourites",
            "POST",
            f"api/favourites/{first_item_id}",
            200,
            headers={'Authorization': f'Bearer {customer_token}'}
        )
        
        if success_add:
            print(f"✅ Added item {first_item_id} to favourites")
            
            # Test get favourites (should have 1 item)
            success_get, favs_data = self.run_test(
                "Get Favourites (Should Have 1 Item)",
                "GET",
                "api/favourites",
                200,
                headers={'Authorization': f'Bearer {customer_token}'}
            )
            
            if success_get and isinstance(favs_data, list) and len(favs_data) == 1:
                print("✅ Favourites list contains 1 item as expected")
            else:
                print(f"⚠️  Expected 1 favourite, got {len(favs_data) if isinstance(favs_data, list) else 'invalid response'}")
            
            # Test remove from favourites
            success_remove, remove_response = self.run_test(
                "Remove Item from Favourites",
                "DELETE",
                f"api/favourites/{first_item_id}",
                200,
                headers={'Authorization': f'Bearer {customer_token}'}
            )
            
            if success_remove:
                print(f"✅ Removed item {first_item_id} from favourites")
                
                # Test get favourites (should be empty again)
                success_empty_again, empty_again = self.run_test(
                    "Get Favourites After Removal (Should Be Empty)",
                    "GET",
                    "api/favourites",
                    200,
                    headers={'Authorization': f'Bearer {customer_token}'}
                )
                
                if success_empty_again and isinstance(empty_again, list) and len(empty_again) == 0:
                    print("✅ Favourites list empty after removal")
        
        # Test add non-existent item to favourites (should fail)
        self.run_test(
            "Add Non-existent Item to Favourites (Should Fail)",
            "POST",
            "api/favourites/non-existent-id",
            404,
            headers={'Authorization': f'Bearer {customer_token}'}
        )
        
        return success_reg and success_add and success_remove

    def test_customer_orders_endpoints(self):
        """Test customer order history endpoints"""
        print("\n" + "="*50)
        print("TESTING CUSTOMER ORDER HISTORY")
        print("="*50)
        
        # Register a customer for order testing
        timestamp = datetime.now().strftime("%H%M%S")
        test_email = f"ordertest{timestamp}@test.com"
        
        success_reg, reg_data = self.run_test(
            "Register Customer for Order History Test",
            "POST",
            "api/auth/register",
            200,
            data={
                "name": "Order Test User",
                "email": test_email,
                "password": "Test1234"
            }
        )
        
        if not success_reg or 'token' not in reg_data:
            print("❌ Cannot test order history without customer registration")
            return False
        
        customer_token = reg_data['token']
        
        # Test get empty order history initially
        success_empty, empty_orders = self.run_test(
            "Get Empty Order History",
            "GET",
            "api/my-orders",
            200,
            headers={'Authorization': f'Bearer {customer_token}'}
        )
        
        if success_empty and isinstance(empty_orders, list) and len(empty_orders) == 0:
            print("✅ Empty order history returned correctly")
        
        # Get menu items to create an order
        success_menu, menu_data = self.run_test(
            "Get Menu for Order Test",
            "GET",
            "api/menu",
            200
        )
        
        if not success_menu or not menu_data:
            print("❌ Cannot test orders without menu data")
            return False
        
        # Create an order while logged in as customer
        test_order = {
            "items": [
                {"menu_item_id": menu_data[0]['id'], "quantity": 2}
            ],
            "customer_name": "Order Test User",
            "customer_email": test_email,
            "customer_phone": "1234567890",
            "notes": "Test order for customer"
        }
        
        success_order, order_data = self.run_test(
            "Create Order as Logged-in Customer",
            "POST",
            "api/orders",
            200,
            data=test_order,
            headers={'Authorization': f'Bearer {customer_token}'}
        )
        
        if success_order and 'id' in order_data:
            print(f"✅ Order created with ID: {order_data['id']}")
            
            # Test get order history (should have 1 order)
            success_history, history_data = self.run_test(
                "Get Order History (Should Have 1 Order)",
                "GET",
                "api/my-orders",
                200,
                headers={'Authorization': f'Bearer {customer_token}'}
            )
            
            if success_history and isinstance(history_data, list) and len(history_data) == 1:
                print("✅ Order history contains 1 order as expected")
                order = history_data[0]
                if order.get('id') == order_data['id']:
                    print("✅ Order ID matches created order")
                if order.get('customer_name') == test_order['customer_name']:
                    print("✅ Customer name matches")
            else:
                print(f"⚠️  Expected 1 order in history, got {len(history_data) if isinstance(history_data, list) else 'invalid response'}")
        
        return success_reg and success_order

def main():
    print("🧪 Starting Baba Falooda API Tests")
    print("=" * 60)
    
    tester = BabaFaloodaAPITester()
    
    # Run all test suites
    test_results = {
        'menu': tester.test_menu_endpoints(),
        'story': tester.test_story_endpoint(),
        'auth': tester.test_auth_endpoints(),
        'favourites': tester.test_favourites_endpoints(),
        'customer_orders': tester.test_customer_orders_endpoints(),
        'orders': tester.test_order_endpoints(),
        'ai': tester.test_ai_endpoints(),
        'admin': tester.test_admin_endpoints(),
        'checkout': tester.test_checkout_endpoints()
    }
    
    # Print final results
    print("\n" + "="*60)
    print("📊 FINAL TEST RESULTS")
    print("="*60)
    print(f"Tests passed: {tester.tests_passed}/{tester.tests_run}")
    print(f"Success rate: {(tester.tests_passed/tester.tests_run*100):.1f}%")
    
    print("\n📋 Test Suite Results:")
    for suite, result in test_results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {suite.upper()}: {status}")
    
    if tester.failed_tests:
        print(f"\n❌ Failed Tests ({len(tester.failed_tests)}):")
        for test in tester.failed_tests:
            error_msg = test.get('error', f"Expected {test.get('expected')}, got {test.get('actual')}")
            print(f"  - {test['name']}: {error_msg} ({test['endpoint']})")
    
    # Return appropriate exit code
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())