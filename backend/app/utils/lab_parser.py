import re
from typing import Literal

def _parse_numeric_value(val_str: str | None) -> float | None:
    if not val_str:
        return None
    cleaned = val_str.strip().replace(",", "")
    match = re.search(r"[-+]?\d*\.?\d+", cleaned)
    if not match:
        return None
    try:
        return float(match.group(0))
    except ValueError:
        return None

def compute_test_status(value_str: str | None, range_str: str | None) -> Literal["normal", "high", "low", "unspecified"]:
    """Compute normal/high/low status deterministically from a value and reference range string."""
    if not value_str or not range_str:
        return "unspecified"
        
    val = _parse_numeric_value(value_str)
    if val is None:
        return "unspecified"
        
    # Clean the range string
    r = range_str.lower().strip().replace(",", "")
    
    # Range format: "min - max" or "min to max"
    range_match = re.search(r"([-+]?\d*\.?\d+)\s*(?:-|to)\s*([-+]?\d*\.?\d+)", r)
    if range_match:
        try:
            min_val = float(range_match.group(1))
            max_val = float(range_match.group(2))
            if min_val > max_val:
                min_val, max_val = max_val, min_val  # Swap if backwards
                
            if val < min_val:
                return "low"
            elif val > max_val:
                return "high"
            else:
                return "normal"
        except ValueError:
            pass

    # Format: "< max" or "up to max" or "less than max"
    if "<" in r or "up to" in r or "less than" in r:
        limit_match = re.search(r"([-+]?\d*\.?\d+)", r)
        if limit_match:
            try:
                max_val = float(limit_match.group(1))
                if val <= max_val:
                    return "normal"
                else:
                    return "high"
            except ValueError:
                pass

    # Format: "> min" or "more than min" or "greater than min"
    if ">" in r or "more than" in r or "greater than" in r:
        limit_match = re.search(r"([-+]?\d*\.?\d+)", r)
        if limit_match:
            try:
                min_val = float(limit_match.group(1))
                if val >= min_val:
                    return "normal"
                else:
                    return "low"
            except ValueError:
                pass

    return "unspecified"
