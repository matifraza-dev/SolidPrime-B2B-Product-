import pytest
from rest_framework.test import APIClient


@pytest.mark.django_db
class TestAuthFlow:
    def test_register_creates_org_and_admin(self):
        client = APIClient()
        resp = client.post("/api/auth/register/", {
            "organization_name": "New Co", "email": "founder@newco.com",
            "password": "SuperSecret123", "first_name": "Grace",
        })
        assert resp.status_code == 201
        assert resp.data["user"]["role"] == "admin"
        assert "access" in resp.data

    def test_duplicate_email_registration_rejected(self):
        client = APIClient()
        payload = {
            "organization_name": "A", "email": "dup@x.com",
            "password": "SuperSecret123", "first_name": "X",
        }
        client.post("/api/auth/register/", payload)
        resp = client.post("/api/auth/register/", {**payload, "organization_name": "B"})
        assert resp.status_code == 400

    def test_login_returns_role_in_token_claims(self):
        import jwt
        client = APIClient()
        client.post("/api/auth/register/", {
            "organization_name": "A", "email": "u@x.com",
            "password": "SuperSecret123", "first_name": "X",
        })
        resp = client.post("/api/auth/login/", {"email": "u@x.com", "password": "SuperSecret123"})
        assert resp.status_code == 200
        decoded = jwt.decode(resp.data["access"], options={"verify_signature": False})
        assert decoded["role"] == "admin"

@pytest.mark.django_db
class TestTeamManagement:
    def test_admin_can_add_update_and_remove_team_member(self):
        client = APIClient()
        reg = client.post("/api/auth/register/", {
            "organization_name": "Acme Ops", "email": "boss@acme.com",
            "password": "SuperSecret123", "first_name": "Boss",
        })
        client.credentials(HTTP_AUTHORIZATION="Bearer " + reg.data["access"])

        created = client.post("/api/team/", {
            "email": "dev@acme.com", "first_name": "Dev", "last_name": "One",
            "role": "employee", "job_title": "Engineer", "password": "SuperSecret123",
        })
        assert created.status_code == 201
        pub_id = created.data["public_id"]

        patched = client.patch("/api/team/" + pub_id + "/", {"role": "manager", "is_active_member": False})
        assert patched.status_code == 200
        assert patched.data["role"] == "manager"
        assert patched.data["is_active_member"] is False

        deleted = client.delete("/api/team/" + pub_id + "/")
        assert deleted.status_code == 204
