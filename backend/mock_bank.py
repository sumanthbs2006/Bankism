"""Mock Banking Service: simulated accounts, balances, recipients, and ledger."""

import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple
from backend.db import get_db_connection


class MockBankingService:
    """Simulated banking backend service.
    
    CRITICAL SECURITY INVARIANT:
    No method in this service authorizes transactions.
    Privileged state mutations (transfers) must ONLY be invoked after 
    passing the deterministic Authorization Gate.
    """

    @staticmethod
    def get_accounts() -> List[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM accounts")
        rows = cursor.fetchall()
        accounts = []
        today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        for row in rows:
            acc = dict(row)
            # Reset daily limit counter if new day
            if acc["last_reset_date"] != today_str:
                acc["daily_transferred_today"] = 0.0
                cursor.execute(
                    "UPDATE accounts SET daily_transferred_today = 0.0, last_reset_date = ? WHERE account_id = ?",
                    (today_str, acc["account_id"])
                )
            accounts.append(acc)
        conn.commit()
        conn.close()
        return accounts

    @staticmethod
    def get_account(account_id: str) -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM accounts WHERE account_id = ?", (account_id,))
        row = cursor.fetchone()
        if not row:
            conn.close()
            return None
        acc = dict(row)
        today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        if acc["last_reset_date"] != today_str:
            acc["daily_transferred_today"] = 0.0
            cursor.execute(
                "UPDATE accounts SET daily_transferred_today = 0.0, last_reset_date = ? WHERE account_id = ?",
                (today_str, acc["account_id"])
            )
            conn.commit()
        conn.close()
        return acc

    @staticmethod
    def get_recipients() -> List[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM recipients")
        rows = cursor.fetchall()
        recipients = [dict(row) for row in rows]
        conn.close()
        return recipients

    @staticmethod
    def get_recipient_by_name(name: str) -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor()
        # Case-insensitive match on name
        cursor.execute("SELECT * FROM recipients WHERE LOWER(name) = LOWER(?)", (name.strip(),))
        row = cursor.fetchone()
        conn.close()
        return dict(row) if row else None

    @staticmethod
    def get_transactions(limit: int = 50) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM transactions ORDER BY timestamp DESC LIMIT ?", (limit,))
        rows = cursor.fetchall()
        transactions = [dict(row) for row in rows]
        conn.close()
        return transactions

    @staticmethod
    def execute_mock_transfer(
        source_account_id: str,
        recipient: str,
        amount: float,
        currency: str = "INR",
        memo: Optional[str] = None,
        request_id: Optional[str] = None
    ) -> Tuple[bool, str, Optional[str], Optional[float]]:
        """Privileged mock transfer execution.
        
        Returns:
            (success: bool, message: str, transaction_id: Optional[str], new_balance: Optional[float])
        """
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("SELECT * FROM accounts WHERE account_id = ?", (source_account_id,))
            account = cursor.fetchone()
            if not account:
                conn.close()
                return False, f"Account {source_account_id} not found.", None, None

            acc_dict = dict(account)
            current_balance = acc_dict["balance"]

            if current_balance < amount:
                conn.close()
                return False, f"Insufficient balance ({current_balance:.2f} < {amount:.2f}).", None, None

            new_balance = round(current_balance - amount, 2)
            today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            new_daily = acc_dict["daily_transferred_today"] + amount if acc_dict["last_reset_date"] == today_str else amount

            # Deduct balance
            cursor.execute("""
                UPDATE accounts 
                SET balance = ?, daily_transferred_today = ?, last_reset_date = ? 
                WHERE account_id = ?
            """, (new_balance, new_daily, today_str, source_account_id))

            # Record in ledger
            tx_id = f"TX-{uuid.uuid4().hex[:8].upper()}"
            now_iso = datetime.now(timezone.utc).isoformat()
            cursor.execute("""
                INSERT INTO transactions 
                (transaction_id, timestamp, source_account_id, recipient, amount, currency, memo, status, request_id, simulation_mode)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (tx_id, now_iso, source_account_id, recipient, amount, currency, memo or "", "COMPLETED", request_id, 1))

            conn.commit()
            conn.close()
            return True, "Mock transaction completed successfully.", tx_id, new_balance
        except Exception as e:
            conn.rollback()
            conn.close()
            return False, f"Database transaction error: {str(e)}", None, None
