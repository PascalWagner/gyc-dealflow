const projectRootUrl = new URL('../', import.meta.url);
const appEnvironmentStubUrl = new URL('./test-stubs/app-environment.mjs', import.meta.url);

export async function resolve(specifier, context, nextResolve) {
	if (specifier === '$app/environment') {
		return {
			url: appEnvironmentStubUrl.href,
			shortCircuit: true
		};
	}

	if (specifier.startsWith('$lib/')) {
		return {
			url: new URL(`src/lib/${specifier.slice(5)}`, projectRootUrl).href,
			shortCircuit: true
		};
	}

	return nextResolve(specifier, context);
}
