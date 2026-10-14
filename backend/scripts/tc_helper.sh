#!/usr/bin/env bash
# NetSlice Restricted Linux Traffic Control (tc) Privileged Helper Script
# Enforces strictly validated slice bandwidth classes on a Linux router/gateway interface.
# Prevents arbitrary shell injection by validating all arguments against strict regexes.

set -euo pipefail

ACTION="${1:-}"
IFACE="${2:-}"

# Regex validation
validate_iface() {
    if [[ ! "$1" =~ ^[a-zA-Z0-9_.-]+$ ]]; then
        echo "ERROR: Invalid network interface name: '$1'" >&2
        exit 1
    fi
    if ! ip link show "$1" >/dev/null 2>&1; then
        echo "ERROR: Network interface '$1' does not exist on this host." >&2
        exit 1
    fi
}

validate_number() {
    if [[ ! "$1" =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
        echo "ERROR: Invalid bandwidth rate value: '$1'" >&2
        exit 1
    fi
}

case "$ACTION" in
    apply)
        validate_iface "$IFACE"
        LL_RATE="${3:-30.0}"
        HB_RATE="${4:-50.0}"
        GEN_RATE="${5:-20.0}"
        PARENT_TOTAL="${6:-100.0}"

        validate_number "$LL_RATE"
        validate_number "$HB_RATE"
        validate_number "$GEN_RATE"
        validate_number "$PARENT_TOTAL"

        # Check sum invariant using awk
        SUM=$(awk "BEGIN {print $LL_RATE + $HB_RATE + $GEN_RATE}")
        IS_OVER=$(awk "BEGIN {print ($SUM > $PARENT_TOTAL + 0.1) ? 1 : 0}")
        if [[ "$IS_OVER" -eq 1 ]]; then
            echo "ERROR: Sum of slice rates ($SUM Mbps) exceeds total budget ($PARENT_TOTAL Mbps)." >&2
            exit 2
        fi

        echo "[NETSLICE-TC] Configuring HTB on interface: $IFACE"

        # Check if root qdisc already exists
        if tc qdisc show dev "$IFACE" | grep -q "qdisc htb 1:"; then
            echo "[NETSLICE-TC] Modifying active leaf classes (non-disruptive update)"
            tc class change dev "$IFACE" parent 1:1 classid 1:10 htb rate "${LL_RATE}mbit" ceil "${PARENT_TOTAL}mbit" prio 1
            tc class change dev "$IFACE" parent 1:1 classid 1:20 htb rate "${HB_RATE}mbit" ceil "${PARENT_TOTAL}mbit" prio 3
            tc class change dev "$IFACE" parent 1:1 classid 1:30 htb rate "${GEN_RATE}mbit" ceil "${PARENT_TOTAL}mbit" prio 2
        else
            echo "[NETSLICE-TC] Initializing clean HTB hierarchy"
            tc qdisc del dev "$IFACE" root 2>/dev/null || true
            tc qdisc add dev "$IFACE" root handle 1: htb default 30
            tc class add dev "$IFACE" parent 1: classid 1:1 htb rate "${PARENT_TOTAL}mbit" ceil "${PARENT_TOTAL}mbit"

            # Leaf classes with fq_codel latency management
            tc class add dev "$IFACE" parent 1:1 classid 1:10 htb rate "${LL_RATE}mbit" ceil "${PARENT_TOTAL}mbit" prio 1
            tc qdisc add dev "$IFACE" parent 1:10 handle 10: fq_codel quantum 300 target 5ms

            tc class add dev "$IFACE" parent 1:1 classid 1:20 htb rate "${HB_RATE}mbit" ceil "${PARENT_TOTAL}mbit" prio 3
            tc qdisc add dev "$IFACE" parent 1:20 handle 20: fq_codel

            tc class add dev "$IFACE" parent 1:1 classid 1:30 htb rate "${GEN_RATE}mbit" ceil "${PARENT_TOTAL}mbit" prio 2
            tc qdisc add dev "$IFACE" parent 1:30 handle 30: fq_codel

            # Flow filters
            tc filter add dev "$IFACE" protocol ip parent 1:0 prio 1 u32 match ip dport 9101 0xffff flowid 1:10
            tc filter add dev "$IFACE" protocol ip parent 1:0 prio 1 u32 match ip tos 0xb8 0xfc flowid 1:10
            tc filter add dev "$IFACE" protocol ip parent 1:0 prio 2 u32 match ip dport 9102 0xffff flowid 1:20
            tc filter add dev "$IFACE" protocol ip parent 1:0 prio 3 u32 match ip dport 9103 0xffff flowid 1:30
        fi

        echo "SUCCESS: Applied slice rates to $IFACE: URLLC=${LL_RATE}M, eMBB=${HB_RATE}M, mMTC=${GEN_RATE}M"
        ;;

    rollback)
        validate_iface "$IFACE"
        echo "[NETSLICE-TC] Tearing down traffic control on: $IFACE"
        tc qdisc del dev "$IFACE" root 2>/dev/null || true
        echo "SUCCESS: Cleaned up traffic control rules on $IFACE."
        ;;

    verify)
        validate_iface "$IFACE"
        if tc qdisc show dev "$IFACE" | grep -q "qdisc htb 1:" && \
           tc class show dev "$IFACE" | grep -q "class htb 1:10"; then
            echo "VERIFIED: HTB slice hierarchy active on $IFACE."
            exit 0
        else
            echo "NOT_ACTIVE: No active NetSlice HTB qdisc found on $IFACE."
            exit 3
        fi
        ;;

    status)
        validate_iface "$IFACE"
        echo "=== QDISC STATUS ==="
        tc qdisc show dev "$IFACE"
        echo "=== CLASS HIERARCHY ==="
        tc -s class show dev "$IFACE"
        ;;

    *)
        echo "Usage: $0 {apply|rollback|verify|status} <interface> [ll_mbps] [hb_mbps] [gen_mbps] [total_mbps]" >&2
        exit 1
        ;;
esac
