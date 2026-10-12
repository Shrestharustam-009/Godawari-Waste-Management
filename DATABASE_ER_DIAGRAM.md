# Godawari Waste Management - Database ER Diagram

This document contains the Entity-Relationship (ER) diagram for the Godawari Waste Management system, showing the strict relational architecture required for CBMS compliance (specifically the immutable `IncomeLedger` and its relationships).

## Entity-Relationship Diagram

```mermaid
erDiagram
    %% Core Entities
    GlobalSettings {
        Int id PK
        Int billingCycleDay
        String companyName
        String companyAddress
        String panNumber
        String hsCode
    }

    User {
        Int id PK
        String name
        String username
        String role
        Boolean isActive
    }

    Customer {
        String customerId PK
        String name
        String phone
        String assignedArea
        String vatNumber
        Decimal monthlyFee
        Decimal outstandingPayment
        Decimal advanceBalance
    }

    Vehicle {
        Int id PK
        String vehicleId
        String registrationNumber
        String type
    }

    %% Ledger & Billing (Immutable Accounting)
    IncomeLedger {
        Int id PK
        DateTime date
        Decimal amount
        Decimal baseAmount
        Decimal vatAmount
        String paymentMethod
        Int printCount "IRD CBMS Requirement"
        String hsCode "IRD CBMS Requirement"
        Boolean isSyncedWithIRD
        Boolean isSalesReturn
        Int returnRefId "FK to self"
        DateTime createdAt
    }

    BillingLedger {
        Int id PK
        DateTime date
        Decimal amount
        String description
    }

    ExpenseLedger {
        Int id PK
        DateTime date
        Decimal amount
        Decimal baseAmount
        Decimal vatRate
        String subCategory
    }

    SalaryLedger {
        Int id PK
        DateTime date
        Decimal basicPay
        Decimal netPay
    }

    %% Categories
    IncomeCategory {
        Int id PK
        String name
    }

    ExpenseCategory {
        Int id PK
        String name
    }

    %% Security & Audit
    AuditLog {
        Int id PK
        String action
        String entityType
        String entityId
        String ipAddress
        DateTime createdAt
    }

    RefreshToken {
        Int id PK
        String token
        DateTime expiresAt
    }

    %% Relationships
    Customer ||--o{ IncomeLedger : "makes payments"
    Customer ||--o{ BillingLedger : "receives automated bills"
    User ||--o{ IncomeLedger : "collects payment"
    IncomeCategory ||--o{ IncomeLedger : "categorizes"
    
    ExpenseCategory ||--o{ ExpenseLedger : "categorizes"
    Vehicle |o--o{ ExpenseLedger : "incurs"
    
    User ||--o{ SalaryLedger : "receives"
    
    User ||--o{ AuditLog : "performs"
    User ||--o{ RefreshToken : "owns (staff/admin)"
    Customer ||--o{ RefreshToken : "owns (client)"
    
    Vehicle ||--o{ User : "assigned to driver"
```

## Non-Deletable Bill Enforcement (Immutability)

To comply with the IRD Computerized Billing System (CBMS) requirements, the `IncomeLedger` table is strictly protected by PostgreSQL database-level triggers.

1. **`prevent_income_ledger_update`:** Any `UPDATE` statement executed against the `IncomeLedger` table is immediately rejected by the database engine.
2. **`prevent_income_ledger_delete`:** Any `DELETE` statement executed against the `IncomeLedger` table is immediately rejected by the database engine.

Errors in billing must be corrected by creating a **Credit Note (Sales Return)**, which generates a new compensating transaction referencing the original ID (`returnRefId`), preserving the complete, immutable historical audit trail.
