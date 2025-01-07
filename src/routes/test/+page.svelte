<script>
	class Counter {
		ctr = $state(0);
		xname = 'CTR';
		inc() {
			this.ctr++;
		}
		chgName() {
			this.xname = 'CTR' + this.ctr.toString();
			console.log('chgName', this.xname);
		}
	}

	const ca = new Counter();
	$inspect('ca', ca);
	$effect(() => {
		ca;
		console.log('effect ca', ca);
	});
	$effect(() => {
		ca;
		console.log('effect cactr', ca.ctr);
	});
	// let { ctr: ca1 } = ca;
	let { ctr: ca2 } = $state(ca);
	let { ctr: ca3 } = $state(ca);
	let { ctr: ca4 } = $derived(ca);

	const cb = $state(new Counter());
	$inspect('cb', cb);
	$effect(() => {
		cb;
		console.log('effect cb', cb);
	});
	$effect(() => {
		cb;
		console.log('effect cbctr', cb.ctr);
	});
	// let { ctr: cb1 } = cb;
	let { ctr: cb2 } = $state(cb);
	let { ctr: cb3 } = $state(cb);
	let { ctr: cb4 } = $derived(cb);

	const cc = $derived(new Counter());
	$inspect('cc', cc);
	$effect(() => {
		cc;
		console.log('effect cc', cc);
	});
	$effect(() => {
		cc;
		console.log('effect ccctr', cc.ctr);
	});
	// let { ctr: cc1 } = cc;
	// let { ctr: cc2 } = $state(cc);
	// let { ctr: cc3 } = $state(cc);
	let { ctr: cc4 } = $derived(cc);
</script>

<!-- <p>ca1 {ca1}</p> -->
<p>ca2 {ca2}</p>
<p>ca3 {ca3}</p>
<p>ca4 {ca4}</p>
<p>ca {ca.ctr}</p>

<!-- <button onclick={() => ca1++}>CA1</button> -->
<button onclick={() => ca2++}>CA2</button>
<button onclick={() => ca3++}>CA3</button>
<button onclick={() => ca.inc()}>CAA</button>
<button onclick={() => ca.ctr++}>CAB</button>
<button onclick={() => ca.chgName()}>CAN</button>

<!-- <p>cb1 {cb1}</p> -->
<p>cb2 {cb2}</p>
<p>cb3 {cb3}</p>
<p>cb4 {cb4}</p>
<p>cb {cb.ctr}</p>

<!-- <button onclick={() => cb1++}>CB1</button> -->
<button onclick={() => cb2++}>CB2</button>
<button onclick={() => cb3++}>CB3</button>
<button onclick={() => cb.inc()}>CBA</button>
<button onclick={() => cb.ctr++}>CBB</button>
<button onclick={() => cb.chgName()}>CBN</button>

<!-- <p>cc1 {cc1}</p>
<p>cc2 {cc2}</p>
<p>cc3 {cc3}</p> -->
<p>cc4 {cc4}</p>
<p>cc {cc.ctr}</p>

<!-- <button onclick={() => cc1++}>CC1</button>
<button onclick={() => cc2++}>CC2</button>
<button onclick={() => cc3++}>CC2</button> -->
<button onclick={() => cc.inc()}>CCA</button>
<button onclick={() => cc.ctr++}>CCB</button>
<button onclick={() => cc.chgName()}>CCN</button>
