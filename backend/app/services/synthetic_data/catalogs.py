"""Small, synthetic-safe catalogues used by the data generator."""

from __future__ import annotations

LOCATION_CATALOG: tuple[tuple[str, str, str], ...] = (
    ("Chennai", "Tamil Nadu", "600-A"),
    ("Coimbatore", "Tamil Nadu", "641-A"),
    ("Madurai", "Tamil Nadu", "625-A"),
    ("Bengaluru", "Karnataka", "560-A"),
    ("Mysuru", "Karnataka", "570-A"),
    ("Hubballi", "Karnataka", "580-A"),
    ("Hyderabad", "Telangana", "500-A"),
    ("Warangal", "Telangana", "506-A"),
    ("Vijayawada", "Andhra Pradesh", "520-A"),
    ("Visakhapatnam", "Andhra Pradesh", "530-A"),
    ("Pune", "Maharashtra", "411-A"),
    ("Nagpur", "Maharashtra", "440-A"),
    ("Nashik", "Maharashtra", "422-A"),
    ("Ahmedabad", "Gujarat", "380-A"),
    ("Surat", "Gujarat", "395-A"),
    ("Jaipur", "Rajasthan", "302-A"),
    ("Indore", "Madhya Pradesh", "452-A"),
    ("Bhopal", "Madhya Pradesh", "462-A"),
    ("Lucknow", "Uttar Pradesh", "226-A"),
    ("Kanpur", "Uttar Pradesh", "208-A"),
    ("Patna", "Bihar", "800-A"),
    ("Bhubaneswar", "Odisha", "751-A"),
    ("Kolkata", "West Bengal", "700-A"),
    ("Kochi", "Kerala", "682-A"),
)

LOAN_TYPES: tuple[str, ...] = (
    "two_wheeler",
    "three_wheeler",
    "used_vehicle",
    "consumer_durable",
)

LOAN_TYPE_WEIGHTS: tuple[float, ...] = (0.52, 0.12, 0.23, 0.13)

LOAN_AMOUNT_RANGES: dict[str, tuple[int, int]] = {
    "two_wheeler": (45_000, 190_000),
    "three_wheeler": (140_000, 520_000),
    "used_vehicle": (180_000, 950_000),
    "consumer_durable": (15_000, 120_000),
}

ECOSYSTEM_PATTERNS: tuple[str, ...] = (
    "shared_device",
    "shared_account",
    "dealer_burst",
    "mixed_ring",
)
