"""Manual live-server integration script (run with Python, not pytest)."""

import httpx


def main() -> None:
    base_url = "http://127.0.0.1:8000/api/v1"

    with httpx.Client(base_url=base_url) as client:
        import uuid

        # 0. Register disposable test account
        disposable_email = f"disposable_{uuid.uuid4().hex[:8]}@example.com"
        password = "Password123!"
        reg_res = client.post(
            "/auth/register",
            json={
                "email": disposable_email,
                "password": password,
                "full_name": "Disposable Test Patient",
                "phone_number": "+1234567890",
            },
        )
        assert reg_res.status_code == 201, f"Registration failed: {reg_res.text}"

        # 1. Login
        res = client.post(
            "/auth/login",
            json={"email": disposable_email, "password": password},
        )
        assert res.status_code == 200, f"Login failed: {res.text}"
        token = res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print(f"[PASS] Login successful for disposable account {disposable_email}")

        # Seed one report so reports flow can be verified
        upload_res = client.post(
            "/reports",
            headers=headers,
            files={"file": ("disposable_report.pdf", b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF", "application/pdf")},
            data={"report_type": "Complete Blood Count (CBC)"},
        )
        assert upload_res.status_code == 201, f"Report upload failed: {upload_res.text}"

        # 2. List Reports
        res = client.get("/reports", headers=headers)
        assert res.status_code == 200
        reports = res.json()["reports"]
        print(f"[PASS] Listed {len(reports)} reports")
        assert len(reports) > 0
        report_id = reports[0]["id"]
        report_name = reports[0]["filename"]

        # 3. Preview Endpoint
        res = client.get(f"/reports/{report_id}/file?disposition=inline", headers=headers)
        assert res.status_code == 200, f"Preview failed: {res.status_code}"
        assert "inline" in res.headers.get("content-disposition", "")
        content_type = res.headers.get("content-type")
        print(f"[PASS] Preview action works for {report_name} (Content-Type: {content_type}, Size: {len(res.content)} bytes)")

        # 4. Download Endpoint
        res = client.get(f"/reports/{report_id}/file?disposition=attachment", headers=headers)
        assert res.status_code == 200, f"Download failed: {res.status_code}"
        assert "attachment" in res.headers.get("content-disposition", "")
        print(f"[PASS] Download action works for {report_name}")

        # 5. Analyze Endpoint (without Gemini key -> honest 503 error, no made-up results)
        res = client.post(f"/reports/{report_id}/analyze", headers=headers)
        assert res.status_code == 503, f"Expected 503 for unconfigured key, got: {res.status_code} {res.text}"
        err_detail = res.json()["detail"]
        assert "Gemini API key is not configured" in err_detail or "not configured" in err_detail
        print(f"[PASS] Analyze action honestly refused without Gemini key: {err_detail}")

        # 6. Trends Endpoint
        res = client.get("/reports/trends", headers=headers)
        assert res.status_code == 200
        trends_data = res.json()
        print(f"[PASS] Trends endpoint accessible (total confirmed reports: {trends_data.get('total_reports', 0)})")

        # 7. Add Medicine
        med_payload = {
            "name": "Metformin",
            "strength": "500mg",
            "form": "Tablet",
            "instructions": "Take with dinner",
            "current_quantity": 30,
            "refill_threshold": 5,
            "schedule": {
                "frequency": "daily",
                "times_per_day": 1,
                "specific_times": ["20:00"],
                "timezone": "UTC",
            },
        }
        res = client.post("/medicines", json=med_payload, headers=headers)
        assert res.status_code == 201, f"Create medicine failed: {res.text}"
        med = res.json()
        med_id = med["id"]
        print(f"[PASS] Created medicine: {med['name']} (ID: {med_id}, Stock: {med['current_quantity']})")

        # 8. List Medicines (verify persistence)
        res = client.get("/medicines", headers=headers)
        assert res.status_code == 200
        meds = res.json()["medicines"]
        assert any(m["id"] == med_id for m in meds)
        print(f"[PASS] Medicines persistence verified ({len(meds)} active medicines)")

        # 9. Today's Doses
        res = client.get("/medicines/doses/today", headers=headers)
        assert res.status_code == 200
        today_doses = res.json()
        print(f"[PASS] Today's scheduled doses retrieved: {today_doses['total_doses']} total doses")
        med_dose = next((d for d in today_doses["doses"] if d["medicine_id"] == med_id), None)
        assert med_dose is not None, "Scheduled dose for Metformin not found in today doses"
        assert med_dose["status"] in ("pending", "due")
        print(f"[PASS] Metformin dose found with status: {med_dose['status']} at {med_dose['time_str']}")

        # 10. Log Dose as 'taken'
        scheduled_time_val = med_dose["scheduled_time"]
        print(f"[INSPECT] med_dose['scheduled_time'] value: {scheduled_time_val!r} (type: {type(scheduled_time_val).__name__})")
        dose_payload = {
            "scheduled_time": scheduled_time_val,
            "status": "taken",
            "notes": "Taken with dinner",
        }
        dose_url = f"{base_url}/medicines/{med_id}/doses"
        res = client.post(f"/medicines/{med_id}/doses", json=dose_payload, headers=headers)
        print(f"[INSPECT] Dose request URL: {dose_url}")
        print(f"[INSPECT] Dose request HTTP status code: {res.status_code}")
        print(f"[INSPECT] Dose request response: {res.text}")
        assert res.status_code == 201, f"Log dose failed: {res.text}"
        log_entry = res.json()
        print(f"[PASS] Dose successfully recorded as taken (Log ID: {log_entry['id']})")

        # 11. Check inventory decrement (30 -> 29)
        res = client.get(f"/medicines/{med_id}", headers=headers)
        assert res.status_code == 200
        updated_med = res.json()
        assert updated_med["current_quantity"] == 29, f"Expected 29 units, got {updated_med['current_quantity']}"
        print(f"[PASS] Medicine inventory successfully decremented from 30 to {updated_med['current_quantity']}")

        # 12. Verify Today's Doses reflects 'taken' status
        res = client.get("/medicines/doses/today", headers=headers)
        assert res.status_code == 200
        today_doses_after = res.json()
        updated_dose = next(d for d in today_doses_after["doses"] if d["medicine_id"] == med_id)
        assert updated_dose["status"] == "taken"
        print(f"[PASS] Today's dose status updated to 'taken', completed count: {today_doses_after['taken_count']}")

        # 13. Verify Deduplication (logging same dose again returns 409 Conflict)
        res = client.post(f"/medicines/{med_id}/doses", json=dose_payload, headers=headers)
        assert res.status_code == 409, f"Expected 409 Conflict on duplicate dose, got {res.status_code}"
        print("[PASS] Duplicate dose intake prevention confirmed (409 Conflict)")

        # 14. Verify Adherence Summary
        res = client.get("/medicines/doses/history?days=30", headers=headers)
        assert res.status_code == 200
        adh = res.json()
        print(f"[PASS] Adherence history calculated: {adh['adherence_rate_percent']}% adherence (Taken: {adh['taken']})")

        # 15. Reminder Status
        res = client.get("/medicines/reminders/status", headers=headers)
        assert res.status_code == 200
        rem_status = res.json()
        assert rem_status["in_app_enabled"] is True
        assert rem_status["external_delivery_available"] is False
        print(f"[PASS] Reminder provider status honest: {rem_status['provider_name']} ({rem_status['message']})")

    print("\nALL LIVE API & FEATURE INTEGRATION FLOWS VERIFIED SUCCESSFULLY!")


if __name__ == "__main__":
    main()
